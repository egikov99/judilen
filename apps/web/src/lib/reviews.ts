import { db, houses, reviews } from "@judilen/db";
import { desc, eq, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";

export interface PublicReview {
  id: string;
  customerName: string;
  rating: number;
  text: string;
  source: string;
  houseName: string | null;
  createdAt: Date;
}

async function loadPublishedReviews() {
  return db.select({
    id: reviews.id,
    customerName: reviews.customerName,
    rating: reviews.rating,
    text: reviews.text,
    source: reviews.source,
    houseName: houses.name,
    createdAt: reviews.createdAt
  })
    .from(reviews)
    .leftJoin(houses, eq(reviews.houseId, houses.id))
    .where(eq(reviews.isPublished, true))
    .orderBy(desc(reviews.createdAt));
}

export const getPublishedReviews = unstable_cache(loadPublishedReviews, ["published-reviews"], {
  revalidate: 300,
  tags: ["reviews"]
});

export async function getPublishedReviewStats() {
  const [row] = await db.select({
    count: sql<number>`count(*)::int`,
    average: sql<number>`coalesce(round(avg(${reviews.rating})::numeric, 1), 0)::float`
  }).from(reviews).where(eq(reviews.isPublished, true));
  return row ?? { count: 0, average: 0 };
}
