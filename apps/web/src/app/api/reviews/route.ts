import { bookings, customers, db, reviews } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getPublishedReviews } from "@/lib/reviews";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const reviewSchema = z.object({
  name: z.string().min(2).max(80),
  bookingNumber: z.string().min(5).max(40),
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().min(20).max(2000),
  consent: z.literal("on")
});

export async function POST(request: Request) {
  const form = Object.fromEntries(await request.formData());
  const parsed = reviewSchema.safeParse(form);
  const rate = await checkRateLimit(request, {
    scope: "review.create",
    limit: 5,
    windowMs: 60 * 60_000,
    identifier: parsed.success ? parsed.data.email : null
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  if (!parsed.success) return Response.json({ error: "Некорректные данные", details: parsed.error.flatten() }, { status: 422 });
  const [booking] = await db
    .select({ bookingId: bookings.id, houseId: bookings.houseId, status: bookings.status, checkOut: bookings.checkOut, userId: customers.userId })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(eq(bookings.publicNumber, parsed.data.bookingNumber), eq(customers.email, parsed.data.email)))
    .limit(1);
  if (!booking) return Response.json({ error: "Бронирование не найдено" }, { status: 404 });
  const today = new Date().toISOString().slice(0, 10);
  if (booking.checkOut >= today || ["cancelled", "declined"].includes(booking.status)) {
    return Response.json({ error: "Отзыв доступен после завершения поездки" }, { status: 409 });
  }
  await db.insert(reviews).values({
    customerName: parsed.data.name,
    customerEmail: parsed.data.email,
    bookingId: booking.bookingId,
    userId: booking.userId,
    houseId: booking.houseId,
    rating: parsed.data.rating,
    text: parsed.data.text,
    isPublished: false,
    status: "pending",
    source: "site"
  }).onConflictDoNothing();
  return Response.redirect(new URL("/otzyvy?sent=1", request.url), 303);
}

export async function GET() {
  return Response.json({ items: await getPublishedReviews() });
}
