"use client";

import { useState } from "react";
import { dashboardRange, type DashboardPreset } from "@/lib/date-ranges";
import { formatCurrency } from "@/components/currency";

type EventRow = { id: string; date: string; houseName: string; firstName: string; lastName: string; source: string; status: string };
type Data = {
  startDate: string; endDate: string;
  metrics: { revenue: number; bookingCount: number; occupancy: number; averageCheck: number; cancellations: number; newRequests: number };
  arrivals: EventRow[]; departures: EventRow[];
  sources: Array<{ source: string; count: number }>;
  services: Array<{ title: string; quantity: number }>;
};
const labels: Record<string, string> = { site: "Сайт", crm_manual: "CRM", booking: "Booking", airbnb: "Airbnb", ostrovok: "Ostrovok", expedia: "Expedia", ical: "iCal" };

export function DashboardView({ initial }: { initial: Data }) {
  const [data, setData] = useState(initial);
  const [preset, setPreset] = useState<DashboardPreset>("month");
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [loading, setLoading] = useState(false);
  async function load(start: string, end: string) {
    setLoading(true);
    const response = await fetch(`/api/admin/dashboard?startDate=${start}&endDate=${end}`);
    const body = await response.json();
    setLoading(false);
    if (response.ok) { setData(body); setStartDate(start); setEndDate(end); }
  }
  function choose(next: DashboardPreset) {
    setPreset(next);
    if (next !== "custom") { const range = dashboardRange(next); load(range.startDate, range.endDate); }
  }
  const empty = data.metrics.bookingCount === 0;
  return <div className="form-stack">
    <div className="period-toolbar">
      <select value={preset} onChange={(event) => choose(event.target.value as DashboardPreset)}><option value="today">Сегодня</option><option value="7">7 дней</option><option value="30">30 дней</option><option value="month">Текущий месяц</option><option value="previous_month">Прошлый месяц</option><option value="quarter">Квартал</option><option value="year">Год</option><option value="custom">Свой период</option></select>
      <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      <button className="button button-primary" disabled={loading} onClick={() => load(startDate, endDate)}>Показать</button>
      <span className="period-label">{startDate} — {endDate}</span>
    </div>
    {empty && <p className="notice">Нет данных за выбранный период.</p>}
    <div className="stat-grid dashboard-stat-grid">
      <div className="stat-card"><div className="stat-label">Выручка</div><div className="stat-value">{formatCurrency(data.metrics.revenue)}</div></div>
      <div className="stat-card"><div className="stat-label">Бронирования</div><div className="stat-value">{data.metrics.bookingCount}</div></div>
      <div className="stat-card"><div className="stat-label">Загрузка домиков</div><div className="stat-value">{data.metrics.occupancy}%</div></div>
      <div className="stat-card"><div className="stat-label">Средний чек</div><div className="stat-value">{formatCurrency(data.metrics.averageCheck)}</div></div>
      <div className="stat-card"><div className="stat-label">Отмены</div><div className="stat-value">{data.metrics.cancellations}</div></div>
      <div className="stat-card"><div className="stat-label">Новые заявки</div><div className="stat-value">{data.metrics.newRequests}</div></div>
    </div>
    <div className="dashboard-columns">
      <EventTable title="Ближайшие заезды" rows={data.arrivals} />
      <EventTable title="Ближайшие выезды" rows={data.departures} />
    </div>
    <div className="dashboard-columns">
      <section className="panel"><h2>Источники</h2>{data.sources.length ? data.sources.map((row) => <div className="summary-row" key={row.source}><span>{labels[row.source] ?? row.source}</span><strong>{row.count}</strong></div>) : <p className="notice">Нет данных за выбранный период.</p>}</section>
      <section className="panel"><h2>Услуги</h2>{data.services.length ? data.services.map((row) => <div className="summary-row" key={row.title}><span>{row.title}</span><strong>{row.quantity}</strong></div>) : <p className="notice">Нет данных за выбранный период.</p>}</section>
    </div>
  </div>;
}

function EventTable({ title, rows }: { title: string; rows: EventRow[] }) {
  return <section className="panel"><h2>{title}</h2>{rows.length ? <table className="data-table compact-table"><thead><tr><th>Дата</th><th>Дом</th><th>Гость</th><th>Источник</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.houseName}</td><td>{row.firstName} {row.lastName}</td><td>{labels[row.source] ?? row.source}</td></tr>)}</tbody></table> : <p className="notice">Нет данных за выбранный период.</p>}</section>;
}
