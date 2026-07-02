import { bookings, db, houseImages, houses as houseTable } from "@judilen/db";
import { and, asc, desc, eq, gt, gte, inArray, lt, notExists } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { blockingBookingStatuses } from "./booking-availability";
import { houses as fallbackHouses, type House } from "./catalog";

type AvailabilityCriteria = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

function fallbackAllowed() {
  return process.env.ALLOW_STATIC_FALLBACK === "true" || process.env.NODE_ENV === "development";
}

function eyebrow(guests: number) {
  if (guests <= 2) return "Для двоих";
  if (guests >= 6) return "Для семьи";
  return "Флагманский дом";
}

async function loadPublishedHouses(availability?: AvailabilityCriteria): Promise<House[]> {
  try {
    const hasOverlappingBooking = availability
      ? db.select({ id: bookings.id }).from(bookings).where(and(
          eq(bookings.houseId, houseTable.id),
          inArray(bookings.status, blockingBookingStatuses),
          lt(bookings.checkIn, availability.checkOut),
          gt(bookings.checkOut, availability.checkIn)
        ))
      : null;
    const rows = await db
      .select({ house: houseTable, image: houseImages })
      .from(houseTable)
      .leftJoin(houseImages, and(eq(houseTable.id, houseImages.houseId), eq(houseImages.isActive, true)))
      .where(and(
        eq(houseTable.isPublished, true),
        availability ? gte(houseTable.guests, availability.guests) : undefined,
        hasOverlappingBooking ? notExists(hasOverlappingBooking) : undefined
      ))
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
      images: house.images.length ? house.images : ["/images/stitch/asset-025_1.jpg"]
    }));
  } catch (error) {
    if (fallbackAllowed() && !availability) {
      console.warn("Using local catalog fallback because the database is unavailable");
      return fallbackHouses;
    }
    throw error;
  }
}

export const getPublishedHouses = unstable_cache(() => loadPublishedHouses(), ["published-houses"], {
  revalidate: 300,
  tags: ["houses"]
});

export function getAvailablePublishedHouses(criteria: AvailabilityCriteria) {
  return loadPublishedHouses(criteria);
}

export async function getHouseBySlug(slug: string) {
  return (await getPublishedHouses()).find((house) => house.slug === slug);
}
