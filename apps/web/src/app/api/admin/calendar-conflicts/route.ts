import { calendarConflicts, db, externalCalendars, houses } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("calendar_conflicts.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const items = await db.select({
    conflict: calendarConflicts,
    houseName: houses.name,
    calendarName: externalCalendars.name
  }).from(calendarConflicts)
    .innerJoin(houses, eq(calendarConflicts.houseId, houses.id))
    .innerJoin(externalCalendars, eq(calendarConflicts.externalCalendarId, externalCalendars.id))
    .orderBy(desc(calendarConflicts.createdAt));
  return Response.json({ items: items.map(({ conflict, ...relations }) => ({ ...conflict, ...relations })) });
}
