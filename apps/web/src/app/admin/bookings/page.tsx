import { bookings, customers, db, houses } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { BookingStatusControl } from "@/components/admin/booking-status-control";
import { formatCurrency } from "@/lib/catalog";
import { requirePagePermission } from "@/lib/session";

export default async function AdminBookingsPage() {
  await requirePagePermission("bookings.read");
  const rows = await db.select({
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
    .limit(200);
  return <main className="admin-content"><h1 className="admin-title">Бронирования</h1><p className="admin-subtitle">Заявки со всех каналов, оплаты и история статусов.</p><section className="panel"><div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginBottom: 20 }}><div className="field" style={{ width: 330 }}><label htmlFor="search">Поиск</label><input id="search" placeholder="Номер, имя или телефон" /></div></div><table className="data-table"><thead><tr><th>Номер</th><th>Гость</th><th>Дом</th><th>Даты</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.publicNumber}</td><td>{row.customerFirstName} {row.customerLastName}</td><td>{row.houseName}</td><td>{row.checkIn} — {row.checkOut}</td><td>{formatCurrency(Number(row.totalAmount))}</td><td><BookingStatusControl id={row.id} status={row.status} /></td></tr>)}</tbody></table>{!rows.length && <p className="notice">Бронирований пока нет.</p>}</section></main>;
}
