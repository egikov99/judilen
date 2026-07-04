import { db, houseImages, houses } from "@judilen/db";
import { desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAllPermissions } from "@/lib/session";
import { removeUploadedFile, saveImageFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function fallbackAlt(file: File) {
  return file.name.replace(/\.[^.]+$/, "").trim().slice(0, 250) || "Фото домика";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAllPermissions(["uploads.create", "house_images.create"]);
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");

  const { id } = await params;
  const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) return problem(404, "Домик не найден");

  const form = await request.formData();
  const batch = form.getAll("files").filter((value): value is File => value instanceof File);
  const legacyFile = form.get("file");
  const files = batch.length ? batch : legacyFile instanceof File ? [legacyFile] : [];
  const alt = String(form.get("alt") ?? "").trim().slice(0, 250);
  const caption = String(form.get("caption") ?? "").trim();
  if (!files.length) return problem(422, "Файлы не переданы");

  const saved: Array<{ file: File; url: string }> = [];
  for (const file of files) {
    const result = await saveImageFile(file, "houses", id);
    if (!result.ok) {
      await Promise.all(saved.map((item) => removeUploadedFile(item.url)));
      console.warn("House image batch upload rejected", { houseId: id, name: file.name, size: file.size, reason: result.error });
      return problem(
        result.error === "size" ? 413 : 415,
        result.error === "size"
          ? `Файл «${file.name}» превышает допустимый размер 10 МБ`
          : `Файл «${file.name}» должен быть корректным JPEG, PNG или WebP`
      );
    }
    saved.push({ file, url: result.url });
  }

  let items: Array<typeof houseImages.$inferSelect>;
  try {
    items = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`house-images:${id}`}))`);
      const [last] = await tx.select({ position: houseImages.position })
        .from(houseImages)
        .where(eq(houseImages.houseId, id))
        .orderBy(desc(houseImages.position))
        .limit(1);
      const firstPosition = (last?.position ?? -1) + 1;
      return tx.insert(houseImages).values(saved.map(({ file, url }, index) => ({
        houseId: id,
        url,
        alt: alt ? (saved.length > 1 ? `${alt}, фото ${index + 1}` : alt) : fallbackAlt(file),
        caption: caption || null,
        position: firstPosition + index,
        isMain: last === undefined && index === 0,
        isActive: true
      }))).returning();
    });
  } catch (error) {
    await Promise.all(saved.map((item) => removeUploadedFile(item.url)));
    console.error("House image batch could not be persisted", { houseId: id, count: saved.length, error });
    throw error;
  }

  for (const item of items) {
    await writeAudit({ session: auth.session, request, action: "house.image.upload", entityType: "house_image", entityId: item.id, after: item });
  }
  revalidateTag("houses", "max");
  return Response.json({ items }, { status: 201 });
}
