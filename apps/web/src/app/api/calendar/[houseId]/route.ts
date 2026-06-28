import { bookings, db, houses } from "@judilen/db";
import { IcalAdapter } from "@judilen/integrations";
import { and, eq, inArray } from "drizzle-orm";
import { problem } from "@/lib/validation";

export async function GET(_: Request, { params }: { params: Promise<{ houseId: string }> }) {
  const { houseId } = await params;
  const [house] = await db.select({ id: houses.id, name: houses.name }).from(houses).where(eq(houses.id, houseId)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const rows = await db.select().from(bookings).where(and(
    eq(bookings.houseId, houseId),
    inArray(bookings.status, ["awaiting_confirmation", "confirmed", "awaiting_payment", "paid"])
  ));
  const payload = await new IcalAdapter().exportCalendar(rows.map((row) => ({
    externalId: `${row.id}@judilen`,
    title: `Занято — ${house.name}`,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    source: "judilen"
  })));
  return new Response(payload, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${houseId}.ics"`,
      "Cache-Control": "public, max-age=300"
    }
  });
}

