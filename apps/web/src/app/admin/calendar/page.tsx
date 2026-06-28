import { requirePagePermission } from "@/lib/session";

export default async function BookingCalendarPage() {
  await requirePagePermission("bookings.read");
  const days = ["12 пт", "13 сб", "14 вс", "15 пн", "16 вт", "17 ср", "18 чт", "19 пт", "20 сб", "21 вс"];
  const houses = ["Люкс «Кедр»", "Дом «Сосна»", "Студия «Берёза»", "Дом «Дуб»"];
  return <main className="admin-content"><h1 className="admin-title">Шахматка бронирований</h1><p className="admin-subtitle">Июль 2026 · перетаскивание отключено для предотвращения случайных изменений.</p><section className="panel"><div className="calendar"><div className="calendar-head">Дом / дата</div>{days.map((day) => <div className="calendar-head" key={day}>{day}</div>)}{houses.flatMap((house, houseIndex) => [<div className="calendar-house" key={house}>{house}</div>, ...days.map((day, dayIndex) => <div key={`${house}-${day}`}>{((houseIndex === 0 && dayIndex >= 0 && dayIndex <= 2) || (houseIndex === 1 && dayIndex >= 5 && dayIndex <= 8)) && <div className="calendar-booking">{dayIndex === (houseIndex === 0 ? 0 : 5) ? (houseIndex === 0 ? "Смирнов" : "Лебедева") : "·"}</div>}</div>)])}</div></section></main>;
}
