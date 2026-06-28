import { db, integrations } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { syncIcalIntegration } from "@/lib/integration-sync";
import { problem } from "@/lib/validation";

export async function POST(request: Request) {
  const expected = process.env.ICAL_SYNC_CRON_SECRET;
  const received = request.headers.get("authorization");
  if (!expected || received !== `Bearer ${expected}`) return problem(401, "Неверная авторизация");
  const rows = await db.select({ id: integrations.id }).from(integrations).where(and(
    eq(integrations.kind, "ical"),
    eq(integrations.isEnabled, true)
  ));
  const results = await Promise.allSettled(rows.map(({ id }) => syncIcalIntegration(id)));
  return Response.json({
    total: rows.length,
    succeeded: results.filter((result) => result.status === "fulfilled").length,
    failed: results.filter((result) => result.status === "rejected").length
  });
}
