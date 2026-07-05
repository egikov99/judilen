import { bookingExternalRefs, bookings, db, externalCalendars } from "@judilen/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { assertSafeCalendarUrl } from "@/lib/integration-sync";

const updateSchema = z.object({
  provider: z.enum(["ical", "booking", "airbnb", "ostrovok", "expedia", "google_travel", "tripadvisor", "other"]).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  importUrl: z.url().refine((value) => value.startsWith("https://"), "Требуется HTTPS URL").optional(),
  isActive: z.boolean().optional(),
  syncIntervalMinutes: z.coerce.number().int().min(5).max(43_200).optional()
}).refine((value) => Object.keys(value).length > 0, "Нет изменений");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("external_calendars.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  if (parsed.data.importUrl) {
    try {
      await assertSafeCalendarUrl(parsed.data.importUrl);
    } catch (error) {
      return problem(422, "Небезопасный Import iCal URL", error instanceof Error ? error.message : undefined);
    }
  }
  const { id } = await params;
  const [before] = await db.select().from(externalCalendars).where(eq(externalCalendars.id, id)).limit(1);
  if (!before) return problem(404, "Календарь не найден");
  const [after] = await db.update(externalCalendars).set({ ...parsed.data, updatedAt: new Date() }).where(eq(externalCalendars.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "external_calendar.update", entityType: "external_calendar", entityId: id, before, after });
  return Response.json({ item: {
    id: after.id,
    name: after.name,
    provider: after.provider,
    isActive: after.isActive,
    syncIntervalMinutes: after.syncIntervalMinutes
  } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("external_calendars.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(externalCalendars).where(eq(externalCalendars.id, id)).limit(1);
  if (!before) return problem(404, "Календарь не найден");
  await db.transaction(async (tx) => {
    const refs = await tx.select({ bookingId: bookingExternalRefs.bookingId }).from(bookingExternalRefs)
      .where(eq(bookingExternalRefs.externalCalendarId, id));
    if (refs.length) {
      await tx.update(bookings).set({ status: "import_removed", updatedAt: new Date() })
        .where(inArray(bookings.id, refs.map((item) => item.bookingId)));
    }
    await tx.delete(externalCalendars).where(eq(externalCalendars.id, id));
  });
  await writeAudit({ session: auth.session, request, action: "external_calendar.delete", entityType: "external_calendar", entityId: id, before });
  return new Response(null, { status: 204 });
}
