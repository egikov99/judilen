import { db, homepageGalleryImages } from "@judilen/db";
import { asc, desc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { TERRITORY_GALLERY_SECTION } from "@/lib/homepage-gallery";
import { requireAllPermissions, requirePermission } from "@/lib/session";
import { removeUploadedFile, saveImageFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function validSectionKey(value: string) {
  return /^[a-z0-9-]+$/i.test(value);
}

export async function GET(request: Request) {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const sectionKey = new URL(request.url).searchParams.get("section") ?? TERRITORY_GALLERY_SECTION;
  if (!validSectionKey(sectionKey)) return problem(422, "Некорректный ключ раздела");
  const items = await db
    .select()
    .from(homepageGalleryImages)
    .where(eq(homepageGalleryImages.sectionKey, sectionKey))
    .orderBy(asc(homepageGalleryImages.sortOrder));
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireAllPermissions(["content.write", "uploads.create"]);
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");

  const form = await request.formData();
  const sectionKey = String(form.get("sectionKey") ?? TERRITORY_GALLERY_SECTION);
  const alt = String(form.get("alt") ?? "").trim();
  const file = form.get("file");
  if (!validSectionKey(sectionKey) || alt.length < 2) return problem(422, "Требуются корректные sectionKey и alt");
  if (!(file instanceof File)) return problem(422, "Файл не передан");

  const saved = await saveImageFile(file, "content", sectionKey);
  if (!saved.ok) {
    console.warn("Homepage gallery upload rejected", {
      sectionKey,
      name: file.name,
      size: file.size,
      reason: saved.error
    });
    return problem(
      saved.error === "size" ? 413 : 415,
      saved.error === "size"
        ? "Файл превышает допустимый размер"
        : "Допустимы JPEG, PNG и WebP с корректным расширением"
    );
  }

  let item: typeof homepageGalleryImages.$inferSelect;
  try {
    const [last] = await db
      .select({ sortOrder: homepageGalleryImages.sortOrder })
      .from(homepageGalleryImages)
      .where(eq(homepageGalleryImages.sectionKey, sectionKey))
      .orderBy(desc(homepageGalleryImages.sortOrder))
      .limit(1);
    [item] = await db
      .insert(homepageGalleryImages)
      .values({ sectionKey, imageUrl: saved.url, alt, sortOrder: (last?.sortOrder ?? -1) + 1 })
      .returning();
  } catch (error) {
    await removeUploadedFile(saved.url);
    throw error;
  }

  await writeAudit({
    session: auth.session,
    request,
    action: "homepage_gallery_image.upload",
    entityType: "homepage_gallery_image",
    entityId: item.id,
    after: item
  });
  revalidateTag("homepage-gallery", "max");
  return Response.json({ item }, { status: 201 });
}
