import { bookingServices, bookings, db, expenses, houses, salesChannels, services } from "@judilen/db";
import { and, asc, count, eq, gte, lte, notInArray, sql } from "drizzle-orm";
import { formatCurrency } from "@/components/currency";
import { isoDate } from "@/lib/date-ranges";
import { excludedPaidMetricStatuses } from "@/lib/paid-booking-metrics";
import { requirePagePermission } from "@/lib/session";

function reportRange(preset: string, from?: string, to?: string) {
  const today = new Date();
  const end = isoDate(today);
  const start = new Date(today);
  if (preset === "yesterday") {
    start.setUTCDate(start.getUTCDate() - 1);
    return { from: isoDate(start), to: isoDate(start) };
  }
  if (preset === "week") start.setUTCDate(start.getUTCDate() - 6);
  else if (preset === "quarter") start.setUTCMonth(start.getUTCMonth() - 3);
  else if (preset === "year") start.setUTCFullYear(start.getUTCFullYear() - 1);
  else if (preset === "today") return { from: end, to: end };
  else start.setUTCMonth(start.getUTCMonth() - 1);
  return preset === "custom" && from && to ? { from, to } : { from: isoDate(start), to: end };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePagePermission("reports.read");
  const params = await searchParams;
  const preset = params.preset ?? "month";
  const range = reportRange(preset, params.from, params.to);
  const bookingPeriod = and(gte(bookings.checkIn, range.from), lte(bookings.checkIn, range.to));
  const expensePeriod = and(gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to));
  const paidBookingFilter = and(
    bookingPeriod,
    eq(bookings.paymentStatus, "paid"),
    notInArray(bookings.status, [...excludedPaidMetricStatuses]),
    sql`${bookings.totalAmount} > 0`
  );
  const [financeRows, bookingRows, cancellationRows, expenseRows, channelRows, popularHouses, popularServices, houseRevenue, houseCosts, cancellationReasons, houseCountRows] = await Promise.all([
    db.select({
      revenue: sql<string>`coalesce(sum(${bookings.paidAmount}), 0)`,
      averageCheck: sql<string>`coalesce(avg(${bookings.totalAmount}), 0)`,
      paidCount: count(bookings.id),
      guests: sql<string>`coalesce(sum(${bookings.guests}), 0)`,
      nights: sql<string>`coalesce(sum(${bookings.checkOut} - ${bookings.checkIn}), 0)`
    }).from(bookings).where(paidBookingFilter),
    db.select({ value: count() }).from(bookings).where(bookingPeriod),
    db.select({ value: count() }).from(bookings).where(and(bookingPeriod, eq(bookings.status, "cancelled"))),
    db.select({ value: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(expensePeriod),
    db.select({
      id: salesChannels.id,
      name: sql<string>`coalesce(${salesChannels.name}, 'Не указан')`,
      color: sql<string>`coalesce(${salesChannels.color}, '#667066')`,
      bookingsCount: count(bookings.id),
      paidCount: sql<number>`count(*) filter (where ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') and ${bookings.totalAmount} > 0)`,
      cancellations: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled')`,
      revenue: sql<string>`coalesce(sum(case when ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') then ${bookings.paidAmount} else 0 end), 0)`,
      averageCheck: sql<string>`coalesce(avg(case when ${bookings.paymentStatus} = 'paid' and ${bookings.status} not in ('cancelled','declined','blocked','import_removed') and ${bookings.totalAmount} > 0 then ${bookings.totalAmount} end), 0)`
    }).from(bookings).leftJoin(salesChannels, eq(bookings.salesChannelId, salesChannels.id)).where(bookingPeriod).groupBy(salesChannels.id).orderBy(sql`count(${bookings.id}) desc`),
    db.select({ name: houses.name, value: count(bookings.id) }).from(bookings).innerJoin(houses, eq(bookings.houseId, houses.id)).where(and(bookingPeriod, notInArray(bookings.status, ["cancelled", "declined", "blocked", "import_removed"]))).groupBy(houses.id).orderBy(sql`count(${bookings.id}) desc`).limit(10),
    db.select({ name: services.title, count: sql<number>`coalesce(sum(${bookingServices.quantity}), 0)`, revenue: sql<string>`coalesce(sum(${bookingServices.totalPrice}), 0)` }).from(bookingServices).innerJoin(services, eq(bookingServices.serviceId, services.id)).innerJoin(bookings, eq(bookingServices.bookingId, bookings.id)).where(paidBookingFilter).groupBy(services.id).orderBy(sql`sum(${bookingServices.quantity}) desc`).limit(10),
    db.select({ id: houses.id, name: houses.name, revenue: sql<string>`coalesce(sum(${bookings.paidAmount}), 0)` }).from(bookings).innerJoin(houses, eq(bookings.houseId, houses.id)).where(paidBookingFilter).groupBy(houses.id).orderBy(asc(houses.name)),
    db.select({ id: houses.id, costs: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).innerJoin(houses, eq(expenses.houseId, houses.id)).where(expensePeriod).groupBy(houses.id),
    db.select({ reason: sql<string>`coalesce(nullif(${bookings.cancellationReason}, ''), 'Не указана')`, value: count() }).from(bookings).where(and(bookingPeriod, eq(bookings.status, "cancelled"))).groupBy(bookings.cancellationReason).orderBy(sql`count(*) desc`),
    db.select({ value: count() }).from(houses).where(eq(houses.isPublished, true))
  ]);
  const finance = financeRows[0];
  const revenue = Number(finance?.revenue ?? 0);
  const costs = Number(expenseRows[0]?.value ?? 0);
  const totalBookings = bookingRows[0]?.value ?? 0;
  const cancellations = cancellationRows[0]?.value ?? 0;
  const totalNights = Number(finance?.nights ?? 0);
  const houseCount = houseCountRows[0]?.value ?? 0;
  const days = Math.max(1, Math.round((Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000) + 1);
  const occupancy = houseCount ? Math.min(100, Math.round(totalNights / (houseCount * days) * 1000) / 10) : 0;
  const costMap = new Map(houseCosts.map((row) => [row.id, Number(row.costs)]));
  const channelSort = params.channelSort ?? "bookings";
  const sortedChannelRows = [...channelRows].sort((left, right) => channelSort === "revenue"
    ? Number(right.revenue) - Number(left.revenue)
    : channelSort === "average"
      ? Number(right.averageCheck) - Number(left.averageCheck)
      : Number(right.bookingsCount) - Number(left.bookingsCount));
  const exportQuery = new URLSearchParams({ from: range.from, to: range.to });
  return <main className="admin-content"><h1 className="admin-title">Отчеты</h1><p className="admin-subtitle">Финансовые и операционные показатели за выбранный период.</p>
    <form className="panel report-filters"><div className="field"><label>Период</label><select name="preset" defaultValue={preset}><option value="today">Сегодня</option><option value="yesterday">Вчера</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="quarter">Квартал</option><option value="year">Год</option><option value="custom">Произвольный</option></select></div><div className="field"><label>С</label><input name="from" type="date" defaultValue={range.from} /></div><div className="field"><label>По</label><input name="to" type="date" defaultValue={range.to} /></div><div className="field"><label>Сортировка каналов</label><select name="channelSort" defaultValue={channelSort}><option value="bookings">По бронированиям</option><option value="revenue">По выручке</option><option value="average">По среднему чеку</option></select></div><button className="button button-primary">Применить</button><div className="button-row"><a className="button button-ghost" href={`/api/admin/exports/reports?format=xls&${exportQuery}`}>Excel</a><a className="button button-ghost" href={`/api/admin/exports/reports?format=csv&${exportQuery}`}>CSV</a><a className="button button-ghost" href={`/api/admin/exports/reports?format=pdf&${exportQuery}`}>PDF</a></div></form>
    <div className="stat-grid"><Metric title="Выручка" value={formatCurrency(revenue)} /><Metric title="Расходы" value={formatCurrency(costs)} /><Metric title="Прибыль" value={formatCurrency(revenue - costs)} /><Metric title="Средний чек" value={formatCurrency(Number(finance?.averageCheck ?? 0))} /><Metric title="Бронирований" value={String(totalBookings)} /><Metric title="Гостей" value={String(finance?.guests ?? 0)} /><Metric title="Ночей" value={String(totalNights)} /><Metric title="Загрузка" value={`${occupancy}%`} /><Metric title="Отмены" value={`${cancellations}${totalBookings ? ` (${Math.round(cancellations / totalBookings * 1000) / 10}%)` : ""}`} /></div>
    <section className="panel"><h2>Продажи по каналам</h2><div className="channel-chart">{sortedChannelRows.map((row) => { const bookingShare = totalBookings ? Number(row.bookingsCount) / totalBookings * 100 : 0; const revenueShare = revenue ? Number(row.revenue) / revenue * 100 : 0; return <div className="channel-report" key={row.id ?? "none"}><div className="channel-report-title"><span><i className="color-dot" style={{ background: row.color }} />{row.name}</span><strong>{formatCurrency(Number(row.revenue))}</strong></div><div className="channel-bar"><span style={{ width: `${Math.max(2, bookingShare)}%`, background: row.color }} /></div><div className="channel-report-metrics"><span>{row.bookingsCount} броней ({bookingShare.toFixed(1)}%)</span><span>{row.paidCount} оплачено</span><span>{row.cancellations} отмен</span><span>Средний чек {formatCurrency(Number(row.averageCheck))}</span><span>{revenueShare.toFixed(1)}% выручки</span></div></div>; })}</div></section>
    <div className="report-grid"><section className="panel"><h2>Прибыль по домикам</h2>{houseRevenue.map((row) => { const houseCost = costMap.get(row.id) ?? 0; return <div className="profit-row" key={row.id}><strong>{row.name}</strong><span>Выручка {formatCurrency(Number(row.revenue))}</span><span>Расходы {formatCurrency(houseCost)}</span><strong>Прибыль {formatCurrency(Number(row.revenue) - houseCost)}</strong></div>; })}</section><section className="panel"><h2>Популярные домики</h2>{popularHouses.map((row) => <div className="summary-row" key={row.name}><span>{row.name}</span><strong>{row.value}</strong></div>)}</section></div>
    <div className="report-grid"><section className="panel"><h2>Популярные услуги</h2>{popularServices.map((row) => <div className="summary-row" key={row.name}><span>{row.name} · {row.count}</span><strong>{formatCurrency(Number(row.revenue))}</strong></div>)}</section><section className="panel"><h2>Причины отмен</h2>{cancellationReasons.map((row) => <div className="summary-row" key={row.reason}><span>{row.reason}</span><strong>{row.value}</strong></div>)}</section></div>
  </main>;
}

function Metric({ title, value }: { title: string; value: React.ReactNode }) {
  return <div className="stat-card"><div className="stat-label">{title}</div><div className="stat-value">{value}</div></div>;
}
