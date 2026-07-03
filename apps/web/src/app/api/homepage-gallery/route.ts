import { db, homepageGalleryImages } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { normalizeImageUrl } from "@/lib/image-urls";
import { TERRITORY_GALLERY_SECTION } from "@/lib/homepage-gallery";
import { problem } from "@/lib/validation";

export async function GET(request: Request) {
  const sectionKey = new URL(request.url).searchParams.get("section") ?? TERRITORY_GALLERY_SECTION;
  if (!/^[a-z0-9-]+$/i.test(sectionKey)) return problem(422, "Некорректный ключ раздела");

  const rows = await db
    .select()
    .from(homepageGalleryImages)
    .where(eq(homepageGalleryImages.sectionKey, sectionKey))
    .orderBy(asc(homepageGalleryImages.sortOrder));

  return Response.json({
    items: rows.flatMap((row) => {
      const imageUrl = normalizeImageUrl(row.imageUrl);
      if (!imageUrl) {
        console.error("Public homepage gallery image has an invalid URL", { imageId: row.id, imageUrl: row.imageUrl });
        return [];
      }
      return [{ ...row, imageUrl }];
    })
  });
}
