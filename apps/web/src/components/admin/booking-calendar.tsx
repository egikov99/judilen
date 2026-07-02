"use client";

import { useState } from "react";
import { addDays, periodRange, shiftRange, type PeriodPreset } from "@/lib/date-ranges";
import { formatCurrency } from "@/components/currency";

type Booking = { id: string; publicNumber: string; houseId: string; houseName: string; checkIn: string; checkOut: string; status: string; source: string; totalAmount: string; firstName: string; lastName: string; email: string; phone: string; externalUid: string | null; lastSyncedAt: string | null };
type CalendarData = { houses: Array<{ id: string; name: string }>; bookings: Booking[]; conflicts: Array<{ id: string; houseId: string; startDate: string; endDate: string; summary: string }> };
const labels: Record<string, string> = { site: "Сайт", crm_manual: "CRM", manual: "Вручную", blocked: "Блокировка", booking: "Booking", airbnb: "Airbnb", ostrovok: "Ostrovok", expedia: "Expedia", google_travel: "Google Travel", tripadvisor: "TripAdvisor", ical: "iCal" };

export function BookingCalendar({ initial, initialStart, initialEnd, canCreate }: { initial: CalendarData; initialStart: string; initialEnd: string; canCreate: boolean }) {
  const [data, setData] = useState(initial);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [preset, setPreset] = useState<PeriodPreset>("14");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [free, setFree] = useState<{ houseId: string; houseName: string; date: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [houseFilter, setHouseFilter] = useState("");

  async function load(start: string, end: string) {
    setLoading(true);
    const response = await fetch(`/api/admin/bookings/calendar?startDate=${start}&endDate=${end}`);
    const body = await response.json();
    setLoading(false);
    if (response.ok) { setData(body); setStartDate(start); setEndDate(end); }
  }
  function choosePreset(next: PeriodPreset) {
    setPreset(next);
    if (next !== "custom") { const range = periodRange(next); load(range.startDate, range.endDate); }
  }
  const days: string[] = [];
  for (let day = startDate; day <= endDate; day = addDays(day, 1)) days.push(day);
  const visibleHouses = houseFilter ? data.houses.filter((house) => house.id === houseFilter) : data.houses;
  const today = new Date().toISOString().slice(0, 10);

  return <div className="form-stack">
    <div className="period-toolbar">
      <button className="button button-ghost" onClick={() => { const range = shiftRange(startDate, endDate, -1); load(range.startDate, range.endDate); }}>← Предыдущий период</button>
      <button className="button button-ghost" onClick={() => { const range = periodRange(preset === "custom" ? "14" : preset); load(range.startDate, range.endDate); }}>Сегодня</button>
      <button className="button button-ghost" onClick={() => { const range = shiftRange(startDate, endDate, 1); load(range.startDate, range.endDate); }}>Следующий период →</button>
      <select value={preset} onChange={(event) => choosePreset(event.target.value as PeriodPreset)}><option value="7">7 дней</option><option value="14">14 дней</option><option value="30">30 дней</option><option value="month">Месяц</option><option value="quarter">Квартал</option><option value="custom">Свой диапазон</option></select>
      <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
      <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
      <button className="button button-primary" disabled={loading} onClick={() => load(startDate, endDate)}>Показать</button>
      <select aria-label="Режим календаря" defaultValue="" onChange={(event) => {
        const length = Number(event.target.value);
        if (length) load(today, addDays(today, length - 1));
      }}>
        <option value="" disabled>Режим</option>
        <option value="1">День</option>
        <option value="7">Неделя</option>
        <option value="14">2 недели</option>
      </select>
      <select aria-label="Фильтр по домику" value={houseFilter} onChange={(event) => setHouseFilter(event.target.value)}>
        <option value="">Все домики</option>
        {data.houses.map((house) => <option value={house.id} key={house.id}>{house.name}</option>)}
      </select>
    </div>
    <div className="calendar-legend">{Object.entries(labels).map(([source, label]) => <span className="badge source-badge" data-source={source} key={source}>{label}</span>)}<span className="badge conflict-badge">Конфликт</span></div>
    <section className="panel">
      {visibleHouses.length ? <div className="calendar-scroll"><div className="calendar dynamic-calendar" style={{ gridTemplateColumns: `170px repeat(${days.length}, minmax(64px, 1fr))` }}>
        <div className="calendar-head">Дом / дата</div>{days.map((day) => <div className="calendar-head" key={day}>{new Date(`${day}T00:00:00Z`).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", weekday: "short" })}</div>)}
        {visibleHouses.flatMap((house) => [<div className="calendar-house" key={house.id}>{house.name}</div>, ...days.map((day) => {
          const booking = data.bookings.find((row) => row.houseId === house.id && row.checkIn <= day && row.checkOut > day);
          const conflict = data.conflicts.find((row) => row.houseId === house.id && row.startDate <= day && row.endDate > day);
          const displaySource = booking?.status === "blocked" ? "blocked" : booking?.source;
          return <button className={`calendar-day ${conflict ? "calendar-cell-conflict" : ""}`} key={`${house.id}-${day}`} onClick={() => booking ? setSelected(booking) : canCreate ? setFree({ houseId: house.id, houseName: house.name, date: day }) : undefined}>
            {booking && <span className="calendar-booking" data-source={displaySource}>{booking.checkIn === day ? `${labels[displaySource ?? ""] ?? displaySource}: ${booking.firstName}` : "·"}</span>}
            {conflict && <span className="calendar-conflict">!</span>}
          </button>;
        })])}
      </div></div> : <p className="notice">Домики не найдены.</p>}
    </section>
    {!data.bookings.length && <p className="notice">Нет данных за выбранный период.</p>}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><article className="modal-panel" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><h2>{selected.publicNumber}</h2><div className="summary-row"><span>Домик</span><strong>{selected.houseName}</strong></div><div className="summary-row"><span>Даты</span><strong>{selected.checkIn} — {selected.checkOut}</strong></div><div className="summary-row"><span>Клиент</span><strong>{selected.firstName} {selected.lastName}<br />{selected.phone}</strong></div><div className="summary-row"><span>Сумма</span><strong>{formatCurrency(Number(selected.totalAmount))}</strong></div><div className="summary-row"><span>Источник</span><strong>{labels[selected.source] ?? selected.source}</strong></div><div className="summary-row"><span>Статус</span><strong>{selected.status}</strong></div></article></div>}
    {free && <div className="modal-backdrop" onClick={() => setFree(null)}><article className="modal-panel" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setFree(null)}>×</button><h2>Свободная дата</h2><p>{free.houseName}, {free.date}</p><a className="button button-primary" href={`/admin/bookings?houseId=${free.houseId}&checkIn=${free.date}&checkOut=${addDays(free.date, 1)}`}>Создать бронирование</a></article></div>}
  </div>;
}
