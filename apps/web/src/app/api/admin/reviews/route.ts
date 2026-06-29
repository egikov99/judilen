import { db, houses, reviews } from "@judilen/db";
import { and, desc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { adminReviewSchema, problem } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requirePermission("reviews.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const url = new URL(request.url);
  const houseId = url.searchParams.get("houseId");
  const rating = url.searchParams.get("rating");
  const source = url.searchParams.get("source");
  const filters = [
    houseId ? eq(reviews.houseId, houseId) : undefined,
    rating ? eq(reviews.rating, Number(rating)) : undefined,
    source ? eq(reviews.source, source as "manual") : undefined
  ].filter(Boolean);
  const items = await db.select({ review: reviews, houseName: houses.name })
    .from(reviews)
    .leftJoin(houses, eq(reviews.houseId, houses.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(reviews.createdAt));
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requirePermission("reviews.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = adminReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [review] = await db.insert(reviews).values(parsed.data).returning();
  await writeAudit({ session: auth.session, request, action: "review.create", entityType: "review", entityId: review.id, after: review });
  revalidateTag("reviews", "max");
  return Response.json({ item: review }, { status: 201 });
}
