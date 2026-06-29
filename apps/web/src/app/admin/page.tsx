import { bookings, customers, db, houses } from "@judilen/db";
import { and, asc, count, eq, gte, inArray, lt, sum } from "drizzle-orm";
import Link from "next/link";
import { formatCurrency } from "@/lib/catalog";
import { requirePagePermission } from "@/lib/session";

export default async function AdminDashboardPage() {
  await requirePagePermission("dashboard.read");
  const today = new Date().toISOString().slice(0, 10);
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = tomorrowDate.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;
  const [newRows, arrivals, activeRows, houseRows, revenueRows, events] = await Promise.all([
    db.select({ value: count() }).from(bookings).where(inArray(bookings.status, ["new", "awaiting_confirmation"])),
    db.select({ value: count() }).from(bookings).where(eq(bookings.checkIn, today)),
    db.select({ value: count() }).from(bookings).where(and(
      inArray(bookings.status, ["confirmed", "awaiting_payment", "paid"]),
      gte(bookings.checkOut, today)
    )),
    db.select({ value: count() }).from(houses).where(eq(houses.isPublished, true)),
    db.select({ value: sum(bookings.paidAmount) }).from(bookings).where(gte(bookings.checkIn, monthStart)),
    db.select({
      id: bookings.id,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status,
      houseName: houses.name,
      firstName: customers.firstName,
      lastName: customers.lastName
    }).from(bookings)
      .innerJoin(houses, eq(bookings.houseId, houses.id))
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(and(gte(bookings.checkIn, today), lt(bookings.checkIn, tomorrow)))
      .orderBy(asc(bookings.checkIn))
      .limit(10)
  ]);
  const occupancy = houseRows[0].value ? Math.min(100, Math.round((activeRows[0].value / houseRows[0].value) * 100)) : 0;
  return <main className="admin-content"><h1 className="admin-title">Добрый день</h1><p className="admin-subtitle">Ключевые показатели и задачи на сегодня.</p><div className="stat-grid"><div className="stat-card"><div className="stat-label">Новые заявки</div><div className="stat-value">{newRows[0].value}</div><span className="badge badge-warn">требуют ответа</span></div><div className="stat-card"><div className="stat-label">Заезды сегодня</div><div className="stat-value">{arrivals[0].value}</div><span className="badge">по календарю</span></div><div className="stat-card"><div className="stat-label">Активная загрузка</div><div className="stat-value">{occupancy}%</div><span className="badge">{activeRows[0].value} броней</span></div><div className="stat-card"><div className="stat-label">Оплачено, месяц</div><div className="stat-value">{formatCurrency(Number(revenueRows[0].value ?? 0))}</div><span className="badge">по бронированиям</span></div></div><section className="panel"><h2>Заезды сегодня</h2><table className="data-table"><thead><tr><th>Дата</th><th>Дом</th><th>Гость</th><th>Статус</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.checkIn}</td><td>{event.houseName}</td><td>{event.firstName} {event.lastName}</td><td><span className="badge">{event.status}</span></td></tr>)}</tbody></table>{!events.length && <p className="notice">Сегодня заездов нет.</p>}<p><Link className="text-link" href="/admin/bookings">Все бронирования →</Link></p></section></main>;
}
