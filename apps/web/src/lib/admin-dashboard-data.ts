import { bookingServices, bookings, customers, db, houses, services } from "@judilen/db";
import { and, asc, eq, gt, gte, inArray, lt, notInArray } from "drizzle-orm";
import { addDays } from "./date-ranges";

const activeStatuses = ["pending", "awaiting_confirmation", "confirmed", "awaiting_payment", "paid", "external", "blocked"] as const;
const arrivalStatuses = ["pending", "awaiting_confirmation", "confirmed", "awaiting_payment", "paid", "external"] as const;

export async function getAdminDashboardData(startDate: string, endDate: string) {
  const exclusiveEnd = addDays(endDate, 1);
  const [houseRows, periodBookings, occupancyBookings, arrivals, departures, serviceRows] = await Promise.all([
    db.select({ id: houses.id }).from(houses).where(eq(houses.isPublished, true)),
    db.select().from(bookings).where(and(
      gte(bookings.checkIn, startDate),
      lt(bookings.checkIn, exclusiveEnd),
      notInArray(bookings.status, ["blocked", "import_removed"])
    )),
    db.select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut }).from(bookings).where(and(
      inArray(bookings.status, activeStatuses), lt(bookings.checkIn, exclusiveEnd), gt(bookings.checkOut, startDate)
    )),
    db.select({ id: bookings.id, date: bookings.checkIn, houseName: houses.name, firstName: customers.firstName, lastName: customers.lastName, source: bookings.source, status: bookings.status })
      .from(bookings).innerJoin(houses, eq(bookings.houseId, houses.id)).innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(and(inArray(bookings.status, arrivalStatuses), gte(bookings.checkIn, startDate), lt(bookings.checkIn, exclusiveEnd)))
      .orderBy(asc(bookings.checkIn)).limit(200),
    db.select({ id: bookings.id, date: bookings.checkOut, houseName: houses.name, firstName: customers.firstName, lastName: customers.lastName, source: bookings.source, status: bookings.status })
      .from(bookings).innerJoin(houses, eq(bookings.houseId, houses.id)).innerJoin(customers, eq(bookings.customerId, customers.id))
      .where(and(inArray(bookings.status, arrivalStatuses), lt(bookings.checkOut, exclusiveEnd), gte(bookings.checkOut, startDate)))
      .orderBy(asc(bookings.checkOut)).limit(200),
    db.select({ title: services.title, quantity: bookingServices.quantity })
      .from(bookingServices).innerJoin(services, eq(bookingServices.serviceId, services.id)).innerJoin(bookings, eq(bookingServices.bookingId, bookings.id))
      .where(and(notInArray(bookings.status, ["blocked", "cancelled", "declined", "import_removed"]), gte(bookings.checkIn, startDate), lt(bookings.checkIn, exclusiveEnd)))
  ]);

  const arrivalsInRange = arrivals.filter((item) => item.date >= startDate && item.date <= endDate).slice(0, 10);
  const periodDays = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
  const occupiedNights = occupancyBookings.reduce((sum, booking) => {
    const from = booking.checkIn > startDate ? booking.checkIn : startDate;
    const to = booking.checkOut < exclusiveEnd ? booking.checkOut : exclusiveEnd;
    return sum + Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
  }, 0);
  const sources = new Map<string, number>();
  for (const booking of periodBookings) sources.set(booking.source, (sources.get(booking.source) ?? 0) + 1);
  const serviceStats = new Map<string, number>();
  for (const row of serviceRows) serviceStats.set(row.title, (serviceStats.get(row.title) ?? 0) + row.quantity);
  const revenue = periodBookings.reduce((sum, booking) => sum + Number(booking.paidAmount), 0);
  const totalAmount = periodBookings.reduce((sum, booking) => sum + Number(booking.totalAmount), 0);
  return {
    startDate, endDate,
    metrics: {
      revenue,
      bookingCount: periodBookings.length,
      occupancy: houseRows.length ? Math.min(100, Math.round(occupiedNights / (houseRows.length * periodDays) * 100)) : 0,
      averageCheck: periodBookings.length ? totalAmount / periodBookings.length : 0,
      cancellations: periodBookings.filter((booking) => ["cancelled", "declined"].includes(booking.status)).length,
      newRequests: periodBookings.filter((booking) => ["new", "pending", "awaiting_confirmation"].includes(booking.status)).length
    },
    arrivals: arrivalsInRange,
    departures: departures.slice(0, 10),
    sources: [...sources].map(([source, count]) => ({ source, count })),
    services: [...serviceStats].map(([title, quantity]) => ({ title, quantity }))
  };
}
