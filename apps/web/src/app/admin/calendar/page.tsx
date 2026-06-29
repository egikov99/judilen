import { bookings, customers, db, houses } from "@judilen/db";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { requirePagePermission } from "@/lib/session";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function BookingCalendarPage() {
  await requirePagePermission("bookings.read");
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const days = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return { iso: isoDate(date), label: date.toLocaleDateString("ru-RU", { day: "2-digit", weekday: "short" }) };
  });
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + days.length);
  const [houseRows, bookingRows] = await Promise.all([
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select({
      id: bookings.id,
      houseId: bookings.houseId,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status,
      firstName: customers.firstName,
      lastName: customers.lastName
    }).from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(and(
        inArray(bookings.status, ["awaiting_confirmation", "confirmed", "awaiting_payment", "paid"]),
        lt(bookings.checkIn, isoDate(end)),
        gte(bookings.checkOut, isoDate(start))
      ))
  ]);
  return <main className="admin-content"><h1 className="admin-title">Шахматка бронирований</h1><p className="admin-subtitle">Ближайшие 10 дней по реальным бронированиям.</p><section className="panel">{houseRows.length ? <div className="calendar"><div className="calendar-head">Дом / дата</div>{days.map((day) => <div className="calendar-head" key={day.iso}>{day.label}</div>)}{houseRows.flatMap((house) => [<div className="calendar-house" key={house.id}>{house.name}</div>, ...days.map((day) => {
    const booking = bookingRows.find((row) => row.houseId === house.id && row.checkIn <= day.iso && row.checkOut > day.iso);
    return <div key={`${house.id}-${day.iso}`}>{booking && <div className="calendar-booking">{booking.checkIn === day.iso ? `${booking.firstName} ${booking.lastName}`.trim() : "·"}</div>}</div>;
  })])}</div> : <p className="notice">Домиков пока нет.</p>}</section></main>;
}
