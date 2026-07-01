import { bookings, db } from "@judilen/db";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { blockingBookingStatuses } from "./booking-availability";

export async function findOverlappingBooking(houseId: string, checkIn: string, checkOut: string) {
  const [booking] = await db
    .select({ id: bookings.id, publicNumber: bookings.publicNumber })
    .from(bookings)
    .where(and(
      eq(bookings.houseId, houseId),
      inArray(bookings.status, blockingBookingStatuses),
      lt(bookings.checkIn, checkOut),
      gt(bookings.checkOut, checkIn)
    ))
    .limit(1);
  return booking;
}
