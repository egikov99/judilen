import { bookings, db, houseImages, houses as houseTable, houseWeekdayPrices } from "@judilen/db";
import { and, asc, eq, gt, gte, inArray, lt, notExists } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { blockingBookingStatuses } from "./booking-availability";
import { houses as fallbackHouses, type House } from "./catalog";
import { DEFAULT_IMAGE_URL, normalizeImageUrl } from "./image-urls";
import { uniformWeekdayPrices, weekdayPriceRange } from "./weekday-prices";

type AvailabilityCriteria = {
  checkIn: string;
  checkOut: string;
  guests: number;
};

function fallbackAllowed() {
  return process.env.ALLOW_STATIC_FALLBACK === "true" || process.env.NODE_ENV === "development";
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
    const [rows, priceRows] = await Promise.all([
      db
        .select({ house: houseTable, image: houseImages })
        .from(houseTable)
        .leftJoin(houseImages, and(eq(houseTable.id, houseImages.houseId), eq(houseImages.isActive, true)))
        .where(and(
          eq(houseTable.isPublished, true),
          availability ? gte(houseTable.guests, availability.guests) : undefined,
          hasOverlappingBooking ? notExists(hasOverlappingBooking) : undefined
        ))
        .orderBy(asc(houseTable.name), asc(houseImages.position)),
      db.select().from(houseWeekdayPrices)
    ]);
    const mapped = new Map<string, House>();
    for (const { house, image } of rows) {
      const basePrice = Number(house.basePrice);
      const current = mapped.get(house.id) ?? {
        id: house.id,
        slug: house.slug,
        name: house.name,
        badgeText: house.badgeText,
        description: house.shortDescription,
        longDescription: house.description,
        guests: house.guests,
        rooms: house.rooms,
        price: basePrice,
        minPrice: basePrice,
        maxPrice: basePrice,
        weekdayPrices: uniformWeekdayPrices(basePrice),
        images: [],
        amenities: house.amenities
      };
      if (image) {
        const imageUrl = normalizeImageUrl(image.url);
        if (imageUrl) current.images.push(imageUrl);
        else console.error("House image has an invalid URL", { houseId: house.id, imageId: image.id, url: image.url });
      }
      mapped.set(house.id, current);
    }
    for (const row of priceRows) {
      const house = mapped.get(row.houseId);
      if (house) house.weekdayPrices[row.weekday] = Number(row.price);
    }
    return [...mapped.values()].map((house) => ({
      ...house,
      ...weekdayPriceRange(house.weekdayPrices),
      images: house.images.length ? house.images : [DEFAULT_IMAGE_URL]
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
