import { bookings, customers, db, houses } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { bookingServicesTotal, getBookingServicesMap } from "@/lib/booking-services";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const { id } = await params;
  const [item] = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    status: bookings.status,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    guests: bookings.guests,
    accommodationAmount: bookings.accommodationAmount,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    paymentStatus: bookings.paymentStatus,
    houseName: houses.name,
    houseSlug: houses.slug
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .where(and(eq(bookings.id, id), eq(customers.userId, session.userId)))
    .limit(1);
  if (!item) return problem(404, "Бронирование не найдено");
  const serviceMap = await getBookingServicesMap([id]);
  const itemServices = serviceMap.get(id) ?? [];
  return Response.json({ item: { ...item, servicesTotal: bookingServicesTotal(itemServices), services: itemServices } });
}
