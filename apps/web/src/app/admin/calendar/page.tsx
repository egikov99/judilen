import { BookingCalendar } from "@/components/admin/booking-calendar";
import { getAdminCalendarData } from "@/lib/admin-calendar-data";
import { periodRange } from "@/lib/date-ranges";
import { requirePageAccess } from "@/lib/session";

export default async function BookingCalendarPage() {
  const access = await requirePageAccess("calendar.read");
  const range = periodRange("14");
  const data = await getAdminCalendarData(range.startDate, range.endDate);
  return <main className="admin-content">
    <h1 className="admin-title">Единый календарь</h1>
    <p className="admin-subtitle">Бронирования CRM, сайта и внешних площадок. Дата выезда не считается занятой.</p>
    <BookingCalendar initial={{ ...data, bookings: data.bookings.map((item) => ({ ...item, lastSyncedAt: item.lastSyncedAt?.toISOString() ?? null })) }} initialStart={range.startDate} initialEnd={range.endDate} canCreate={access.permissions.includes("bookings.create")} />
  </main>;
}
