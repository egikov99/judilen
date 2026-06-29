import { bookings, customers, db } from "@judilen/db";
import { count, desc, eq, sql } from "drizzle-orm";
import { formatCurrency } from "@/lib/catalog";
import { requirePagePermission } from "@/lib/session";

export default async function CustomersPage() {
  await requirePagePermission("customers.read");
  const rows = await db.select({
    id: customers.id,
    firstName: customers.firstName,
    lastName: customers.lastName,
    email: customers.email,
    phone: customers.phone,
    bookingsCount: count(bookings.id),
    paid: sql<string>`coalesce(sum(${bookings.paidAmount}), 0)`
  }).from(customers).leftJoin(bookings, eq(customers.id, bookings.customerId)).groupBy(customers.id).orderBy(desc(customers.createdAt));
  return <main className="admin-content"><h1 className="admin-title">Клиенты</h1><p className="admin-subtitle">Контакты и агрегированная история бронирований.</p><section className="panel"><table className="data-table"><thead><tr><th>Клиент</th><th>Контакты</th><th>Бронирований</th><th>Оплачено</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.firstName} {row.lastName}</strong></td><td>{row.email}<br />{row.phone}</td><td>{row.bookingsCount}</td><td>{formatCurrency(Number(row.paid))}</td></tr>)}</tbody></table>{!rows.length && <p className="notice">Клиентов пока нет.</p>}</section></main>;
}
