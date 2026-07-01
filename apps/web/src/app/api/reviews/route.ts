import { bookings, customers, db, reviews } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getPublishedReviews } from "@/lib/reviews";

const reviewSchema = z.object({
  name: z.string().min(2).max(80),
  bookingNumber: z.string().min(5).max(40),
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().min(20).max(2000)
});

export async function POST(request: Request) {
  const form = Object.fromEntries(await request.formData());
  const parsed = reviewSchema.safeParse(form);
  if (!parsed.success) return Response.json({ error: "Некорректные данные", details: parsed.error.flatten() }, { status: 422 });
  const [booking] = await db
    .select({ bookingId: bookings.id, houseId: bookings.houseId, status: bookings.status })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(eq(bookings.publicNumber, parsed.data.bookingNumber), eq(customers.email, parsed.data.email)))
    .limit(1);
  if (!booking) return Response.json({ error: "Бронирование не найдено" }, { status: 404 });
  if (booking.status !== "completed") return Response.json({ error: "Отзыв доступен после завершения поездки" }, { status: 409 });
  await db.insert(reviews).values({
    customerName: parsed.data.name,
    customerEmail: parsed.data.email,
    bookingId: booking.bookingId,
    houseId: booking.houseId,
    rating: parsed.data.rating,
    text: parsed.data.text,
    isPublished: false,
    source: "site"
  }).onConflictDoNothing();
  return Response.redirect(new URL("/otzyvy?sent=1", request.url), 303);
}

export async function GET() {
  return Response.json({ items: await getPublishedReviews() });
}
