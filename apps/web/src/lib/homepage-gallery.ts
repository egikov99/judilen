import { db, homepageGalleryImages } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { normalizeImageUrl } from "./image-urls";

export const TERRITORY_GALLERY_SECTION = "territory";
export const TERRITORY_GALLERY_FALLBACK = "/images/stitch/asset-010.png";

export type HomepageGalleryImage = {
  id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
};

async function loadTerritoryGallery(): Promise<HomepageGalleryImage[]> {
  const rows = await db
    .select()
    .from(homepageGalleryImages)
    .where(eq(homepageGalleryImages.sectionKey, TERRITORY_GALLERY_SECTION))
    .orderBy(asc(homepageGalleryImages.sortOrder));

  return rows.flatMap((row) => {
    const imageUrl = normalizeImageUrl(row.imageUrl);
    if (!imageUrl) {
      console.error("Homepage gallery image has an invalid URL", {
        imageId: row.id,
        sectionKey: row.sectionKey,
        imageUrl: row.imageUrl
      });
      return [];
    }
    return [{ id: row.id, imageUrl, alt: row.alt, sortOrder: row.sortOrder }];
  });
}

export const getTerritoryGallery = unstable_cache(loadTerritoryGallery, ["homepage-gallery-territory"], {
  revalidate: 300,
  tags: ["homepage-gallery"]
});
