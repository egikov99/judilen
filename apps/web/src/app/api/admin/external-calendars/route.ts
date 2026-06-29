import { db, externalCalendars, houses, integrations } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { buildCalendarExportUrl } from "@/lib/calendar-links";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const providerSchema = z.enum(["ical", "booking", "airbnb", "ostrovok", "expedia", "google_travel", "tripadvisor", "other"]);
const calendarSchema = z.object({
  integrationId: z.uuid().nullable().optional(),
  houseId: z.uuid(),
  provider: providerSchema,
  name: z.string().trim().min(2).max(120),
  importUrl: z.url().refine((value) => value.startsWith("https://"), "Требуется HTTPS URL"),
  isActive: z.boolean().default(true),
  syncIntervalMinutes: z.coerce.number().int().min(5).max(43_200).default(60)
});

function exportUrl(request: Request, houseId: string, token: string) {
  const origin = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  return buildCalendarExportUrl(origin, houseId, token);
}

export async function GET(request: Request) {
  const auth = await requirePermission("external_calendars.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rows = await db.select({
    calendar: externalCalendars,
    houseName: houses.name
  }).from(externalCalendars)
    .innerJoin(houses, eq(externalCalendars.houseId, houses.id))
    .orderBy(desc(externalCalendars.createdAt));
  return Response.json({
    items: rows.map(({ calendar, houseName }) => ({
      ...calendar,
      houseName,
      exportUrl: exportUrl(request, calendar.houseId, calendar.exportToken)
    }))
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission("external_calendars.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = calendarSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, parsed.data.houseId)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const item = await db.transaction(async (tx) => {
    let integrationId = parsed.data.integrationId ?? null;
    if (!integrationId) {
      const [integration] = await tx.insert(integrations).values({
        kind: parsed.data.provider,
        name: parsed.data.name,
        config: {},
        isEnabled: parsed.data.isActive
      }).returning({ id: integrations.id });
      integrationId = integration.id;
    }
    const [calendar] = await tx.insert(externalCalendars).values({ ...parsed.data, integrationId }).returning();
    return calendar;
  });
  await writeAudit({ session: auth.session, request, action: "external_calendar.create", entityType: "external_calendar", entityId: item.id, after: item });
  return Response.json({ item: { ...item, exportUrl: exportUrl(request, item.houseId, item.exportToken) } }, { status: 201 });
}
