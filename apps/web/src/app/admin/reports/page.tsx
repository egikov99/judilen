import { bookings, db } from "@judilen/db";
import { count, eq, sql, sum } from "drizzle-orm";
import { formatCurrency } from "@/components/currency";
import { requirePagePermission } from "@/lib/session";

export default async function ReportsPage() {
  await requirePagePermission("reports.read");
  const [revenueRows, bookingRows, cancellationRows, avgRows, channelRows] = await Promise.all([
    db.select({ value: sum(bookings.paidAmount) }).from(bookings),
    db.select({ value: count() }).from(bookings),
    db.select({ value: count() }).from(bookings).where(eq(bookings.status, "cancelled")),
    db.select({ value: sql<string>`coalesce(avg(${bookings.totalAmount}), 0)` }).from(bookings),
    db.select({ source: bookings.externalSource, value: count() }).from(bookings).groupBy(bookings.externalSource)
  ]);
  const totalBookings = bookingRows[0]?.value ?? 0;
  const cancellations = cancellationRows[0]?.value ?? 0;
  const cancellationRate = totalBookings ? Math.round((cancellations / totalBookings) * 1000) / 10 : 0;
  return <main className="admin-content"><h1 className="admin-title">Отчеты</h1><p className="admin-subtitle">Агрегаты по реальным бронированиям из базы данных.</p><div className="stat-grid"><div className="stat-card"><div className="stat-label">Оплачено</div><div className="stat-value">{formatCurrency(Number(revenueRows[0]?.value ?? 0))}</div><span className="badge">по платежам</span></div><div className="stat-card"><div className="stat-label">Бронирований</div><div className="stat-value">{totalBookings}</div><span className="badge">всего</span></div><div className="stat-card"><div className="stat-label">Средний чек</div><div className="stat-value">{formatCurrency(Number(avgRows[0]?.value ?? 0))}</div><span className="badge">по заявкам</span></div><div className="stat-card"><div className="stat-label">Отмены</div><div className="stat-value">{cancellationRate}%</div><span className="badge">{cancellations} отмен</span></div></div><section className="panel"><h2>Каналы</h2>{channelRows.length ? channelRows.map((row) => <div className="summary-row" key={row.source ?? "direct"}><span>{row.source ?? "Прямые"}</span><strong>{row.value}</strong></div>) : <p className="notice">Данных по каналам пока нет.</p>}</section></main>;
}
