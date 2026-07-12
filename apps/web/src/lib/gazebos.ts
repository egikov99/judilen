import { db, gazeboImages, gazebos } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { DEFAULT_IMAGE_URL, normalizeImageUrl } from "@/lib/image-urls";

export interface PublicGazebo {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  amenities: string[];
  sortOrder: number;
  images: string[];
}

function mapPublicGazebos(rows: Array<{ gazebo: typeof gazebos.$inferSelect; image: typeof gazeboImages.$inferSelect | null }>) {
  const mapped = new Map<string, PublicGazebo>();
  for (const { gazebo, image } of rows) {
    const current = mapped.get(gazebo.id) ?? {
      id: gazebo.id,
      title: gazebo.title,
      slug: gazebo.slug,
      shortDescription: gazebo.shortDescription,
      description: gazebo.description,
      amenities: gazebo.amenities,
      sortOrder: gazebo.sortOrder,
      images: []
    };
    if (image) {
      const imageUrl = normalizeImageUrl(image.url);
      if (imageUrl) current.images.push(imageUrl);
      else console.error("Gazebo image has an invalid URL", { gazeboId: gazebo.id, imageId: image.id, url: image.url });
    }
    mapped.set(gazebo.id, current);
  }
  return [...mapped.values()].map((gazebo) => ({
    ...gazebo,
    images: gazebo.images.length ? gazebo.images : [DEFAULT_IMAGE_URL]
  }));
}

async function loadPublicGazebos() {
  const rows = await db.select({ gazebo: gazebos, image: gazeboImages })
    .from(gazebos)
    .leftJoin(gazeboImages, eq(gazebos.id, gazeboImages.gazeboId))
    .where(eq(gazebos.isPublished, true))
    .orderBy(asc(gazebos.sortOrder), asc(gazebos.title), asc(gazeboImages.sortOrder));
  return mapPublicGazebos(rows);
}

export const getPublicGazebos = unstable_cache(loadPublicGazebos, ["public-gazebos"], {
  revalidate: 300,
  tags: ["gazebos"]
});

export async function getPublicGazeboBySlug(slug: string) {
  return (await getPublicGazebos()).find((gazebo) => gazebo.slug === slug);
}
