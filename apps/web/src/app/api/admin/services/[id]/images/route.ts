import { db, serviceImages, services } from "@judilen/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAllPermissions, requirePermission } from "@/lib/session";
import { removeUploadedFile, saveImageFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const items = await db.select().from(serviceImages).where(eq(serviceImages.serviceId, id)).orderBy(asc(serviceImages.sortOrder));
  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAllPermissions(["services.update", "uploads.create"]);
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [service] = await db.select({ id: services.id }).from(services).where(eq(services.id, id)).limit(1);
  if (!service) return problem(404, "Услуга не найдена");

  const form = await request.formData();
  const file = form.get("file");
  const alt = String(form.get("alt") ?? "").trim();
  if (!(file instanceof File)) return problem(422, "Файл не передан");
  if (alt.length < 2 || alt.length > 250) return problem(422, "Alt-текст должен содержать от 2 до 250 символов");

  const saved = await saveImageFile(file, "services", id);
  if (!saved.ok) {
    console.warn("Service image upload rejected", { serviceId: id, name: file.name, size: file.size, reason: saved.error });
    return problem(
      saved.error === "size" ? 413 : 415,
      saved.error === "size" ? "Файл превышает допустимый размер" : "Допустимы JPEG, PNG и WebP с корректным расширением"
    );
  }

  let image: typeof serviceImages.$inferSelect;
  try {
    image = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`service-images:${id}`}))`);
      const [last] = await tx.select({ sortOrder: serviceImages.sortOrder })
        .from(serviceImages)
        .where(eq(serviceImages.serviceId, id))
        .orderBy(desc(serviceImages.sortOrder))
        .limit(1);
      const [created] = await tx.insert(serviceImages).values({
        serviceId: id,
        url: saved.url,
        alt,
        sortOrder: (last?.sortOrder ?? -1) + 1
      }).returning();
      return created;
    });
  } catch (error) {
    await removeUploadedFile(saved.url);
    throw error;
  }

  await writeAudit({ session: auth.session, request, action: "service_image.upload", entityType: "service_image", entityId: image.id, after: image });
  revalidateTag("services", "max");
  return Response.json({ item: image }, { status: 201 });
}
