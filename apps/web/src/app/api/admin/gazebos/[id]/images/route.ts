import { db, gazeboImages, gazebos } from "@judilen/db";
import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { requireAllPermissions, requirePermission } from "@/lib/session";
import { removeUploadedFile, saveImageFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function fallbackAlt(file: File) {
  return file.name.replace(/\.[^.]+$/, "").trim().slice(0, 250) || "Фото беседки";
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("gazebos.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const items = await db.select().from(gazeboImages).where(eq(gazeboImages.gazeboId, id)).orderBy(asc(gazeboImages.sortOrder));
  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAllPermissions(["gazebos.update", "uploads.create"]);
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, {
    scope: "admin.gazebo-images.upload",
    limit: 60,
    windowMs: 60 * 60_000,
    identifier: auth.session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const { id } = await params;
  const [gazebo] = await db.select({ id: gazebos.id }).from(gazebos).where(eq(gazebos.id, id)).limit(1);
  if (!gazebo) return problem(404, "Беседка не найдена");

  const form = await request.formData();
  const batch = form.getAll("files").filter((value): value is File => value instanceof File);
  const legacyFile = form.get("file");
  const files = batch.length ? batch : legacyFile instanceof File ? [legacyFile] : [];
  const alt = String(form.get("alt") ?? "").trim();
  if (!files.length) return problem(422, "Файлы не переданы");
  if (files.length > 50 || files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024) {
    return problem(413, "За один раз можно загрузить до 50 файлов общим размером до 100 МБ");
  }
  if (alt.length > 250) return problem(422, "Alt-текст не должен превышать 250 символов");

  const saved: Array<{ file: File; url: string }> = [];
  for (const file of files) {
    const result = await saveImageFile(file, "gazebos", id);
    if (!result.ok) {
      await Promise.all(saved.map((item) => removeUploadedFile(item.url)));
      console.warn("Gazebo image batch upload rejected", { gazeboId: id, size: file.size, reason: result.error });
      return problem(
        result.error === "size" ? 413 : 415,
        result.error === "size"
          ? `Файл «${file.name}» превышает допустимый размер 10 МБ`
          : `Файл «${file.name}» должен быть корректным JPEG, PNG или WebP`
      );
    }
    saved.push({ file, url: result.url });
  }

  let items: Array<typeof gazeboImages.$inferSelect>;
  try {
    items = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`gazebo-images:${id}`}))`);
      const [last] = await tx.select({ sortOrder: gazeboImages.sortOrder })
        .from(gazeboImages)
        .where(eq(gazeboImages.gazeboId, id))
        .orderBy(desc(gazeboImages.sortOrder))
        .limit(1);
      const firstSortOrder = (last?.sortOrder ?? -1) + 1;
      return tx.insert(gazeboImages).values(saved.map(({ file, url }, index) => ({
        gazeboId: id,
        url,
        alt: alt ? (saved.length > 1 ? `${alt}, фото ${index + 1}` : alt) : fallbackAlt(file),
        sortOrder: firstSortOrder + index
      }))).returning();
    });
  } catch (error) {
    await Promise.all(saved.map((item) => removeUploadedFile(item.url)));
    console.error("Gazebo image batch could not be persisted", { gazeboId: id, count: saved.length, error });
    throw error;
  }

  for (const item of items) {
    await writeAudit({ session: auth.session, request, action: "gazebo_image.upload", entityType: "gazebo_image", entityId: item.id, after: item });
  }
  revalidateTag("gazebos", "max");
  return Response.json({ items, item: items[0] }, { status: 201 });
}
