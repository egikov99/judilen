import { db, houses, reviews } from "@judilen/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { ReviewManager } from "@/components/admin/review-manager";
import { requirePagePermission } from "@/lib/session";

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("reviews.read");
  const params = await searchParams;
  const filters = [
    params.houseId ? eq(reviews.houseId, params.houseId) : undefined,
    params.rating ? eq(reviews.rating, Number(params.rating)) : undefined,
    params.source ? eq(reviews.source, params.source as "manual") : undefined
  ].filter(Boolean);
  const [items, houseRows] = await Promise.all([
    db.select({ review: reviews, houseName: houses.name })
      .from(reviews)
      .leftJoin(houses, eq(reviews.houseId, houses.id))
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(reviews.createdAt)),
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name))
  ]);
  return <main className="admin-content"><h1 className="admin-title">Отзывы</h1><p className="admin-subtitle">Публикация, ручное добавление и модерация отзывов из разных источников.</p><ReviewManager reviews={items} houses={houseRows} /></main>;
}
