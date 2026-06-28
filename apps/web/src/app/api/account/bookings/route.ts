import { bookings, customers, db, houses } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const items = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    status: bookings.status,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    houseName: houses.name,
    houseSlug: houses.slug
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .where(eq(customers.userId, session.userId))
    .orderBy(desc(bookings.checkIn));
  return Response.json({ items });
}

