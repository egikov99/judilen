"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { addDays, periodRange, shiftRange, type PeriodPreset } from "@/lib/date-ranges";
import { formatCurrency } from "@/components/currency";

type Booking = { id: string; publicNumber: string; houseId: string; houseName: string; checkIn: string; checkOut: string; status: string; source: string; totalAmount: string; firstName: string; lastName: string; email: string; phone: string; externalUid: string | null; lastSyncedAt: string | null };
type CalendarData = { houses: Array<{ id: string; name: string }>; bookings: Booking[]; conflicts: Array<{ id: string; houseId: string; startDate: string; endDate: string; summary: string }> };
const labels: Record<string, string> = { site: "Сайт", crm_manual: "CRM", manual: "Вручную", blocked: "Блокировка", booking: "Booking", airbnb: "Airbnb", ostrovok: "Ostrovok", expedia: "Expedia", google_travel: "Google Travel", tripadvisor: "TripAdvisor", ical: "iCal" };
function formatDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("ru-RU");
}

function formatWeekDay(value: string, long = false) {
  const label = new Date(`${value}T00:00:00Z`).toLocaleDateString("ru-RU", { weekday: long ? "long" : "short" }).replace(".", "");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export function BookingCalendar({ initial, initialStart, initialEnd, canCreate }: { initial: CalendarData; initialStart: string; initialEnd: string; canCreate: boolean }) {
  const [data, setData] = useState(initial);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [preset, setPreset] = useState<PeriodPreset>("14");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [free, setFree] = useState<{ houseId: string; houseName: string; date: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [houseFilter, setHouseFilter] = useState("");
  const [mobileView, setMobileView] = useState<"day" | "week">("week");
  const [mobileDatePickerOpen, setMobileDatePickerOpen] = useState(false);

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
  const mobileDays = days.slice(0, mobileView === "day" ? 1 : 7);
  const mobileEndDate = mobileDays.at(-1) ?? startDate;

  function chooseMobileView(next: "day" | "week") {
    setMobileView(next);
    const nextEnd = next === "day" ? startDate : addDays(startDate, 6);
    setPreset(next === "day" ? "custom" : "7");
    load(startDate, nextEnd);
  }

  function chooseMobileStart(nextStart: string) {
    if (!nextStart) return;
    const nextEnd = mobileView === "day" ? nextStart : addDays(nextStart, 6);
    setPreset(mobileView === "day" ? "custom" : "7");
    setMobileDatePickerOpen(false);
    load(nextStart, nextEnd);
  }

  return <div className="form-stack">
    <div className="period-toolbar calendar-desktop-controls">
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
    <div className="mobile-calendar-controls">
      <div className="mobile-calendar-date-control">
        <button type="button" aria-expanded={mobileDatePickerOpen} onClick={() => setMobileDatePickerOpen((value) => !value)}>
          <CalendarDays size={19} aria-hidden="true" />
          <span>{formatDate(startDate)} – {formatDate(mobileEndDate)}</span>
        </button>
        {mobileDatePickerOpen && <div className="mobile-calendar-date-picker">
          <label htmlFor="mobile-calendar-start">Первый день</label>
          <input id="mobile-calendar-start" type="date" value={startDate} onChange={(event) => chooseMobileStart(event.target.value)} />
        </div>}
      </div>
      <div className="mobile-calendar-view" aria-label="Режим календаря">
        <button type="button" className={mobileView === "day" ? "is-active" : ""} aria-pressed={mobileView === "day"} disabled={loading} onClick={() => chooseMobileView("day")}>День</button>
        <button type="button" className={mobileView === "week" ? "is-active" : ""} aria-pressed={mobileView === "week"} disabled={loading} onClick={() => chooseMobileView("week")}>Неделя</button>
      </div>
    </div>
    <div className="calendar-legend calendar-desktop-legend">{Object.entries(labels).map(([source, label]) => <span className="badge source-badge" data-source={source} key={source}>{label}</span>)}<span className="badge conflict-badge">Конфликт</span></div>
    <section className="panel calendar-panel">
      {visibleHouses.length ? <div className="calendar-scroll calendar-desktop"><div className="calendar dynamic-calendar" style={{ gridTemplateColumns: `170px repeat(${days.length}, minmax(64px, 1fr))` }}>
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
      {!!visibleHouses.length && <div className="calendar-mobile">
        {visibleHouses.map((house) => {
          const houseBookings = data.bookings
            .filter((booking) => booking.houseId === house.id && booking.checkIn <= mobileEndDate && booking.checkOut > startDate)
            .sort((left, right) => left.checkIn.localeCompare(right.checkIn));
          const rowCount = Math.max(1, houseBookings.length);
          return <section className="mobile-calendar-house" key={house.id}>
            <h2>{house.name}</h2>
            <div className="mobile-calendar-weekdays">
              {mobileDays.map((day) => <span key={day}>{formatWeekDay(day, mobileView === "day")}</span>)}
            </div>
            <div className="mobile-calendar-track" style={{ gridTemplateColumns: `repeat(${mobileDays.length}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rowCount}, 36px)` }}>
              {Array.from({ length: rowCount }, (_, row) => <div className="mobile-calendar-row" style={{ gridRow: row + 1 }} key={`row-${row}`} />)}
              {mobileDays.map((day, index) => {
                const conflict = data.conflicts.some((row) => row.houseId === house.id && row.startDate <= day && row.endDate > day);
                return <button
                  type="button"
                  className={`mobile-calendar-day ${conflict ? "is-conflict" : ""}`}
                  style={{ gridColumn: index + 1, gridRow: `1 / span ${rowCount}` }}
                  aria-label={`${house.name}, ${formatDate(day)}${conflict ? ", конфликт" : ""}`}
                  onClick={() => canCreate && setFree({ houseId: house.id, houseName: house.name, date: day })}
                  key={day}
                />;
              })}
              {houseBookings.map((booking, row) => {
                const startIndex = booking.checkIn <= startDate ? 0 : mobileDays.findIndex((day) => day === booking.checkIn);
                const endIndex = booking.checkOut > mobileEndDate ? mobileDays.length : mobileDays.findIndex((day) => day === booking.checkOut);
                const displaySource = booking.status === "blocked" ? "blocked" : booking.source;
                return <button
                  type="button"
                  className="mobile-calendar-booking"
                  data-source={displaySource}
                  style={{ gridColumn: `${Math.max(0, startIndex) + 1} / ${Math.max(Math.max(0, startIndex) + 1, endIndex) + 1}`, gridRow: row + 1 }}
                  onClick={() => setSelected(booking)}
                  title={`${labels[displaySource] ?? displaySource}: ${booking.firstName} ${booking.lastName}`}
                  key={booking.id}
                >{labels[displaySource] ?? displaySource}: {booking.firstName}</button>;
              })}
            </div>
          </section>;
        })}
      </div>}
    </section>
    {!data.bookings.length && <p className="notice">Нет данных за выбранный период.</p>}
    {selected && <div className="modal-backdrop" onClick={() => setSelected(null)}><article className="modal-panel" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><h2>{selected.publicNumber}</h2><div className="summary-row"><span>Домик</span><strong>{selected.houseName}</strong></div><div className="summary-row"><span>Даты</span><strong>{selected.checkIn} — {selected.checkOut}</strong></div><div className="summary-row"><span>Клиент</span><strong>{selected.firstName} {selected.lastName}<br />{selected.phone}</strong></div><div className="summary-row"><span>Сумма</span><strong>{formatCurrency(Number(selected.totalAmount))}</strong></div><div className="summary-row"><span>Источник</span><strong>{labels[selected.source] ?? selected.source}</strong></div><div className="summary-row"><span>Статус</span><strong>{selected.status}</strong></div></article></div>}
    {free && <div className="modal-backdrop" onClick={() => setFree(null)}><article className="modal-panel" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setFree(null)}>×</button><h2>Свободная дата</h2><p>{free.houseName}, {free.date}</p><a className="button button-primary" href={`/admin/bookings?houseId=${free.houseId}&checkIn=${free.date}&checkOut=${addDays(free.date, 1)}`}>Создать бронирование</a></article></div>}
  </div>;
}
