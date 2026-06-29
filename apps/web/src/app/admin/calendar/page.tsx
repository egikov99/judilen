import { bookingExternalRefs, bookings, calendarConflicts, customers, db, houses } from "@judilen/db";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { requirePagePermission } from "@/lib/session";

const activeStatuses = ["pending", "awaiting_confirmation", "confirmed", "awaiting_payment", "paid", "external", "blocked"] as const;
const sourceLabels: Record<string, string> = {
  site: "Сайт",
  crm_manual: "CRM",
  booking: "Booking",
  airbnb: "Airbnb",
  ostrovok: "Ostrovok",
  expedia: "Expedia",
  google_travel: "Google Travel",
  tripadvisor: "TripAdvisor",
  ical: "iCal"
};

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
  const [houseRows, bookingRows, conflicts] = await Promise.all([
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select({
      id: bookings.id,
      publicNumber: bookings.publicNumber,
      houseId: bookings.houseId,
      houseName: houses.name,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status,
      source: bookings.source,
      firstName: customers.firstName,
      lastName: customers.lastName,
      externalUid: bookingExternalRefs.externalUid,
      lastSyncedAt: bookingExternalRefs.lastSyncedAt
    }).from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .innerJoin(houses, eq(bookings.houseId, houses.id))
      .leftJoin(bookingExternalRefs, eq(bookingExternalRefs.bookingId, bookings.id))
      .where(and(
        inArray(bookings.status, activeStatuses),
        lt(bookings.checkIn, isoDate(end)),
        gt(bookings.checkOut, isoDate(start))
      )),
    db.select().from(calendarConflicts).where(and(
      eq(calendarConflicts.status, "open"),
      lt(calendarConflicts.startDate, isoDate(end)),
      gt(calendarConflicts.endDate, isoDate(start))
    ))
  ]);

  return <main className="admin-content">
    <h1 className="admin-title">Единый календарь</h1>
    <p className="admin-subtitle">Бронирования CRM, сайта и внешних площадок. Дата выезда не считается занятой.</p>
    <div className="calendar-legend">{Object.entries(sourceLabels).map(([source, label]) => <span className="badge source-badge" data-source={source} key={source}>{label}</span>)}<span className="badge conflict-badge">Конфликт</span></div>
    <section className="panel">
      {houseRows.length ? <div className="calendar"><div className="calendar-head">Дом / дата</div>{days.map((day) => <div className="calendar-head" key={day.iso}>{day.label}</div>)}{houseRows.flatMap((house) => [
        <div className="calendar-house" key={house.id}>{house.name}</div>,
        ...days.map((day) => {
          const booking = bookingRows.find((row) => row.houseId === house.id && row.checkIn <= day.iso && row.checkOut > day.iso);
          const conflict = conflicts.find((row) => row.houseId === house.id && row.startDate <= day.iso && row.endDate > day.iso);
          return <div className={conflict ? "calendar-cell-conflict" : ""} key={`${house.id}-${day.iso}`}>
            {booking && <div className="calendar-booking" data-source={booking.source} title={`${booking.publicNumber} · ${sourceLabels[booking.source] ?? booking.source}`}>{booking.checkIn === day.iso ? `${sourceLabels[booking.source] ?? booking.source}: ${booking.firstName}` : "·"}</div>}
            {conflict && <span className="calendar-conflict" title={conflict.summary}>!</span>}
          </div>;
        })
      ])}</div> : <p className="notice">Домиков пока нет.</p>}
    </section>
    <section className="panel" style={{ marginTop: 20 }}>
      <h2>Бронирования в периоде</h2>
      {bookingRows.length ? <table className="data-table"><thead><tr><th>Источник</th><th>Домик</th><th>Заезд</th><th>Выезд</th><th>Статус</th><th>Внешний UID</th><th>Синхронизация</th></tr></thead><tbody>{bookingRows.map((booking) => <tr key={booking.id}><td><span className="badge source-badge" data-source={booking.source}>{sourceLabels[booking.source] ?? booking.source}</span></td><td>{booking.houseName}</td><td>{booking.checkIn}</td><td>{booking.checkOut}</td><td>{booking.status}</td><td>{booking.externalUid ?? "—"}</td><td>{booking.lastSyncedAt?.toLocaleString("ru-RU") ?? "—"}</td></tr>)}</tbody></table> : <p className="notice">Активных бронирований в периоде нет.</p>}
    </section>
  </main>;
}
