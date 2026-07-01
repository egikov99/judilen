import { bookings, db, externalCalendars, houses } from "@judilen/db";
import { IcalAdapter } from "@judilen/integrations";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { blockingBookingStatuses } from "@/lib/booking-availability";
import { problem } from "@/lib/validation";

export async function exportHouseCalendar(request: Request, houseId: string) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !z.uuid().safeParse(token).success) return problem(404, "Календарь не найден");
  const [calendar] = await db.select({
    houseName: houses.name
  }).from(externalCalendars)
    .innerJoin(houses, eq(externalCalendars.houseId, houses.id))
    .where(and(
      eq(externalCalendars.houseId, houseId),
      eq(externalCalendars.exportToken, token),
      eq(externalCalendars.isActive, true)
    ))
    .limit(1);
  if (!calendar) return problem(404, "Календарь не найден");
  const rows = await db.select().from(bookings).where(and(
    eq(bookings.houseId, houseId),
    inArray(bookings.status, blockingBookingStatuses)
  ));
  const payload = await new IcalAdapter().exportCalendar(rows.map((row) => ({
    externalId: `${row.id}@judilen`,
    title: `Занято - ${calendar.houseName}`,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    source: row.source
  })));
  return new Response(payload, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${houseId}.ics"`,
      "Cache-Control": "private, no-store"
    }
  });
}
