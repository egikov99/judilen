import { db, externalCalendars } from "@judilen/db";
import { and, eq, or, sql } from "drizzle-orm";
import { syncExternalCalendar } from "@/lib/integration-sync";
import { problem } from "@/lib/validation";

export async function POST(request: Request) {
  const expected = process.env.ICAL_SYNC_CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return problem(401, "Неверная авторизация");
  const rows = await db.select({ id: externalCalendars.id }).from(externalCalendars).where(and(
    eq(externalCalendars.isActive, true),
    sql`${externalCalendars.importUrl} is not null`,
    or(
      sql`${externalCalendars.lastSyncAt} is null`,
      sql`${externalCalendars.lastSyncAt} <= now() - (${externalCalendars.syncIntervalMinutes} * interval '1 minute')`
    )
  ));
  const results = await Promise.allSettled(rows.map(({ id }) => syncExternalCalendar(id)));
  return Response.json({
    total: rows.length,
    succeeded: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length
  });
}
