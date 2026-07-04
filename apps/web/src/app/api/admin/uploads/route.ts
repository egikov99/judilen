import { db, houseImages, houses } from "@judilen/db";
import { desc, eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireAllPermissions, requirePermission } from "@/lib/session";
import { removeUploadedFile, saveImageFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let auth = await requirePermission("uploads.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const form = await request.formData();
  const scope = String(form.get("scope") ?? "houses");
  const file = form.get("file");
  if (!(file instanceof File)) {
    console.warn("Image upload rejected: file is missing", { scope });
    return problem(422, "Файл не передан");
  }

  if (scope !== "houses") {
    if (scope !== "content") return problem(422, "Неизвестная область загрузки");
    const result = await saveImageFile(file, scope);
    if (!result.ok) {
      console.warn("Image upload rejected", { scope, name: file.name, size: file.size, reason: result.error });
      return problem(result.error === "size" ? 413 : 415, result.error === "size" ? "Файл превышает допустимый размер" : "Допустимы JPEG, PNG и WebP с корректным расширением");
    }
    return Response.json({ url: result.url }, { status: 201 });
  }

  const houseId = String(form.get("houseId") ?? "");
  const imageId = String(form.get("imageId") ?? "");
  const alt = String(form.get("alt") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const position = Number(form.get("position") ?? 0);
  const isMain = form.get("isMain") === "true" || form.get("isMain") === "on";
  const isActive = form.get("isActive") !== "false";
  auth = await requireAllPermissions(["uploads.create", imageId ? "house_images.update" : "house_images.create"]);
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  if (!houseId || alt.length < 3 || !Number.isInteger(position)) return problem(422, "Требуются houseId, alt и целочисленный position");
  const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, houseId)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const [before] = imageId ? await db.select().from(houseImages).where(eq(houseImages.id, imageId)).limit(1) : [];
  if (imageId && (!before || before.houseId !== houseId)) return problem(404, "Фото не найдено");

  const result = await saveImageFile(file, "houses", houseId);
  if (!result.ok) {
    console.warn("House image upload rejected", { houseId, name: file.name, size: file.size, reason: result.error });
    return problem(result.error === "size" ? 413 : 415, result.error === "size" ? "Файл превышает допустимый размер" : "Допустимы JPEG, PNG и WebP с корректным расширением");
  }
  let image: typeof houseImages.$inferSelect;
  try {
    image = await db.transaction(async (tx) => {
      if (before) {
        if (isMain) await tx.update(houseImages).set({ isMain: false }).where(eq(houseImages.houseId, houseId));
        return (await tx.update(houseImages).set({ url: result.url, alt, caption: caption || null, position, isMain, isActive, updatedAt: new Date() }).where(eq(houseImages.id, before.id)).returning())[0];
      }
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`house-images:${houseId}`}))`);
      const [last] = await tx.select({ position: houseImages.position })
        .from(houseImages)
        .where(eq(houseImages.houseId, houseId))
        .orderBy(desc(houseImages.position))
        .limit(1);
      const shouldBeMain = isMain || !last;
      if (shouldBeMain) await tx.update(houseImages).set({ isMain: false }).where(eq(houseImages.houseId, houseId));
      return (await tx.insert(houseImages).values({
        houseId,
        url: result.url,
        alt,
        caption: caption || null,
        position: (last?.position ?? -1) + 1,
        isMain: shouldBeMain,
        isActive
      }).returning())[0];
    });
  } catch (error) {
    await removeUploadedFile(result.url);
    throw error;
  }
  if (before) await removeUploadedFile(before.url);
  await writeAudit({ session: auth.session, request, action: before ? "house.image.replace" : "house.image.upload", entityType: "house_image", entityId: image.id, before, after: image });
  revalidateTag("houses", "max");
  return Response.json({ item: image }, { status: before ? 200 : 201 });
}
