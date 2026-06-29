import { db, houseImages, houses as houseTable } from "@judilen/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { houses as fallbackHouses, type House } from "./catalog";

function fallbackAllowed() {
  return process.env.ALLOW_STATIC_FALLBACK === "true" || process.env.NODE_ENV === "development";
}

function eyebrow(guests: number) {
  if (guests <= 2) return "Для двоих";
  if (guests >= 6) return "Для семьи";
  return "Флагманский дом";
}

async function loadPublishedHouses(): Promise<House[]> {
  try {
    const rows = await db
      .select({ house: houseTable, image: houseImages })
      .from(houseTable)
      .leftJoin(houseImages, and(eq(houseTable.id, houseImages.houseId), eq(houseImages.isActive, true)))
      .where(eq(houseTable.isPublished, true))
      .orderBy(asc(houseTable.name), desc(houseImages.isMain), asc(houseImages.position));
    const mapped = new Map<string, House>();
    for (const { house, image } of rows) {
      const current = mapped.get(house.id) ?? {
        id: house.id,
        slug: house.slug,
        name: house.name,
        eyebrow: eyebrow(house.guests),
        description: house.shortDescription,
        longDescription: house.description,
        guests: house.guests,
        rooms: house.rooms,
        price: Number(house.basePrice),
        images: [],
        amenities: house.amenities
      };
      if (image) current.images.push(image.url);
      mapped.set(house.id, current);
    }
    return [...mapped.values()].map((house) => ({
      ...house,
      images: house.images.length ? house.images : ["/images/stitch/asset-025.png"]
    }));
  } catch (error) {
    if (fallbackAllowed()) {
      console.warn("Using local catalog fallback because the database is unavailable");
      return fallbackHouses;
    }
    throw error;
  }
}

export const getPublishedHouses = unstable_cache(loadPublishedHouses, ["published-houses"], {
  revalidate: 300,
  tags: ["houses"]
});

export async function getHouseBySlug(slug: string) {
  return (await getPublishedHouses()).find((house) => house.slug === slug);
}
