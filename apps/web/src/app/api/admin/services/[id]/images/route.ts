import { db, serviceImages, services } from "@judilen/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAllPermissions, requirePermission } from "@/lib/session";
import { removeUploadedFile, saveImageFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function fallbackAlt(file: File) {
  return file.name.replace(/\.[^.]+$/, "").trim().slice(0, 250) || "Фото услуги";
}

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
  const batch = form.getAll("files").filter((value): value is File => value instanceof File);
  const legacyFile = form.get("file");
  const files = batch.length ? batch : legacyFile instanceof File ? [legacyFile] : [];
  const alt = String(form.get("alt") ?? "").trim();
  if (!files.length) return problem(422, "Файлы не переданы");
  if (alt.length > 250) return problem(422, "Alt-текст не должен превышать 250 символов");

  const saved: Array<{ file: File; url: string }> = [];
  for (const file of files) {
    const result = await saveImageFile(file, "services", id);
    if (!result.ok) {
      await Promise.all(saved.map((item) => removeUploadedFile(item.url)));
      console.warn("Service image batch upload rejected", { serviceId: id, name: file.name, size: file.size, reason: result.error });
      return problem(
        result.error === "size" ? 413 : 415,
        result.error === "size"
          ? `Файл «${file.name}» превышает допустимый размер 10 МБ`
          : `Файл «${file.name}» должен быть корректным JPEG, PNG или WebP`
      );
    }
    saved.push({ file, url: result.url });
  }

  let items: Array<typeof serviceImages.$inferSelect>;
  try {
    items = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`service-images:${id}`}))`);
      const [last] = await tx.select({ sortOrder: serviceImages.sortOrder })
        .from(serviceImages)
        .where(eq(serviceImages.serviceId, id))
        .orderBy(desc(serviceImages.sortOrder))
        .limit(1);
      const firstSortOrder = (last?.sortOrder ?? -1) + 1;
      return tx.insert(serviceImages).values(saved.map(({ file, url }, index) => ({
        serviceId: id,
        url,
        alt: alt ? (saved.length > 1 ? `${alt}, фото ${index + 1}` : alt) : fallbackAlt(file),
        sortOrder: firstSortOrder + index
      }))).returning();
    });
  } catch (error) {
    await Promise.all(saved.map((item) => removeUploadedFile(item.url)));
    console.error("Service image batch could not be persisted", { serviceId: id, count: saved.length, error });
    throw error;
  }

  for (const item of items) {
    await writeAudit({ session: auth.session, request, action: "service_image.upload", entityType: "service_image", entityId: item.id, after: item });
  }
  revalidateTag("services", "max");
  return Response.json({ items, item: items[0] }, { status: 201 });
}
