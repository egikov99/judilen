import { bookingExternalRefs, bookings, calendarConflicts, customers, db, houses } from "@judilen/db";
import { and, asc, eq, gt, inArray, lt } from "drizzle-orm";
import { addDays } from "./date-ranges";

const activeStatuses = ["pending", "awaiting_confirmation", "confirmed", "awaiting_payment", "paid", "external", "blocked"] as const;

export async function getAdminCalendarData(startDate: string, endDate: string) {
  const exclusiveEnd = addDays(endDate, 1);
  const [houseRows, bookingRows, conflicts] = await Promise.all([
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select({
      id: bookings.id, publicNumber: bookings.publicNumber, houseId: bookings.houseId, houseName: houses.name,
      checkIn: bookings.checkIn, checkOut: bookings.checkOut, status: bookings.status, source: bookings.source,
      totalAmount: bookings.totalAmount, firstName: customers.firstName, lastName: customers.lastName,
      email: customers.email, phone: customers.phone, externalUid: bookingExternalRefs.externalUid,
      lastSyncedAt: bookingExternalRefs.lastSyncedAt
    }).from(bookings)
      .innerJoin(customers, eq(bookings.customerId, customers.id))
      .innerJoin(houses, eq(bookings.houseId, houses.id))
      .leftJoin(bookingExternalRefs, eq(bookingExternalRefs.bookingId, bookings.id))
      .where(and(inArray(bookings.status, activeStatuses), lt(bookings.checkIn, exclusiveEnd), gt(bookings.checkOut, startDate))),
    db.select().from(calendarConflicts).where(and(
      eq(calendarConflicts.status, "open"), lt(calendarConflicts.startDate, exclusiveEnd), gt(calendarConflicts.endDate, startDate)
    ))
  ]);
  return { houses: houseRows, bookings: bookingRows, conflicts };
}
