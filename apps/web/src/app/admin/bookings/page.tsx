import { bookings, customers, db, houses } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { BookingStatusControl } from "@/components/admin/booking-status-control";
import { QuickBookingForm } from "@/components/admin/quick-booking-form";
import { formatCurrency } from "@/components/currency";
import { requirePageAccess } from "@/lib/session";

export default async function AdminBookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requirePageAccess("bookings.read");
  const params = await searchParams;
  const [rows, houseRows] = await Promise.all([db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    customerFirstName: customers.firstName,
    customerLastName: customers.lastName,
    houseName: houses.name,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
    status: bookings.status
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .orderBy(desc(bookings.createdAt))
    .limit(200), db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(houses.name)]);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00.000Z`) + 86_400_000).toISOString().slice(0, 10);
  const defaults = {
    houseId: typeof params.houseId === "string" ? params.houseId : houseRows[0]?.id ?? "",
    checkIn: typeof params.checkIn === "string" ? params.checkIn : today,
    checkOut: typeof params.checkOut === "string" ? params.checkOut : tomorrow
  };
  const canCreate = access.permissions.includes("bookings.create");
  const canUpdate = access.permissions.includes("bookings.update");
  return <main className="admin-content"><h1 className="admin-title">Бронирования</h1><p className="admin-subtitle">Заявки со всех каналов, оплаты и история статусов.</p>{canCreate && (houseRows.length ? <QuickBookingForm houses={houseRows} defaults={defaults} initiallyOpen={typeof params.checkIn === "string"} /> : <p className="notice">Сначала добавьте домик.</p>)}<section className="panel" style={{ marginTop: 20 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 20 }}><div className="field" style={{ width: 330 }}><label htmlFor="search">Поиск</label><input id="search" placeholder="Номер, имя или телефон" /></div></div><table className="data-table"><thead><tr><th>Номер</th><th>Гость</th><th>Дом</th><th>Даты</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.publicNumber}</td><td>{row.customerFirstName} {row.customerLastName}</td><td>{row.houseName}</td><td>{row.checkIn} — {row.checkOut}</td><td>{formatCurrency(Number(row.totalAmount))}</td><td>{canUpdate ? <BookingStatusControl id={row.id} status={row.status} /> : <span className="badge">{row.status}</span>}</td></tr>)}</tbody></table>{!rows.length && <p className="notice">Бронирований пока нет.</p>}</section></main>;
}
