import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  bookingExternalRefs,
  bookings,
  calendarConflicts,
  customers,
  db,
  externalCalendars,
  integrationLogs,
  integrations
} from "@judilen/db";
import { IcalAdapter, reconcileExternalEvents, type ExternalBooking } from "@judilen/integrations";
import { and, desc, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { blockingBookingStatuses } from "./booking-availability";

function isPrivateAddress(address: string) {
  const normalized = address.replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const lower = normalized.toLowerCase();
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || /^fe[89ab]/.test(lower);
}

export async function assertSafeCalendarUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Import iCal URL is required");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only credential-free HTTPS URLs are allowed");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private network destinations are not allowed");
  return url;
}

async function fetchCalendar(importUrl: string) {
  const url = await assertSafeCalendarUrl(importUrl);
  const response = await fetch(url, {
    headers: { Accept: "text/calendar" },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Calendar returned HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > 5_000_000) throw new Error("Calendar exceeds 5 MB");
  return { body, events: await new IcalAdapter().importCalendar(body) };
}

async function findOverlap(houseId: string, event: ExternalBooking, excludedBookingId?: string) {
  return (await db.select({ id: bookings.id, publicNumber: bookings.publicNumber })
    .from(bookings)
    .where(and(
      eq(bookings.houseId, houseId),
      inArray(bookings.status, blockingBookingStatuses),
      lt(bookings.checkIn, event.checkOut),
      gt(bookings.checkOut, event.checkIn),
      excludedBookingId ? ne(bookings.id, excludedBookingId) : undefined
    ))
    .limit(1))[0];
}

async function recordConflict(calendar: typeof externalCalendars.$inferSelect, event: ExternalBooking, rawPayload: Record<string, unknown>) {
  const [existing] = await db.select({
    id: calendarConflicts.id,
    status: calendarConflicts.status,
    startDate: calendarConflicts.startDate,
    endDate: calendarConflicts.endDate
  })
    .from(calendarConflicts)
    .where(and(
      eq(calendarConflicts.externalCalendarId, calendar.id),
      eq(calendarConflicts.externalUid, event.externalId)
    ))
    .orderBy(desc(calendarConflicts.updatedAt))
    .limit(1);
  if (existing?.status === "resolved_keep_crm" && existing.startDate === event.checkIn && existing.endDate === event.checkOut) return false;
  const values = {
    houseId: calendar.houseId,
    source: calendar.provider,
    startDate: event.checkIn,
    endDate: event.checkOut,
    summary: event.title,
    rawPayload,
    updatedAt: new Date()
  };
  if (existing?.status === "open") {
    await db.update(calendarConflicts).set(values).where(eq(calendarConflicts.id, existing.id));
  } else {
    await db.insert(calendarConflicts).values({
      ...values,
      externalCalendarId: calendar.id,
      externalUid: event.externalId
    });
  }
  return true;
}

async function logEvent(calendar: typeof externalCalendars.$inferSelect, level: string, message: string, context?: Record<string, unknown>) {
  if (!calendar.integrationId) return;
  await db.insert(integrationLogs).values({ integrationId: calendar.integrationId, level, message, context });
}

export async function syncExternalCalendar(calendarId: string) {
  const [calendar] = await db.select().from(externalCalendars).where(eq(externalCalendars.id, calendarId)).limit(1);
  if (!calendar || !calendar.isActive || !calendar.importUrl) throw new Error("Active external calendar with an import URL is required");

  const syncStartedAt = new Date();
  try {
    const { body, events } = await fetchCalendar(calendar.importUrl);
    const existingRows = await db.select({
      refId: bookingExternalRefs.id,
      bookingId: bookings.id,
      externalId: bookingExternalRefs.externalUid,
      title: bookings.managerComment,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      status: bookings.status
    }).from(bookingExternalRefs)
      .innerJoin(bookings, eq(bookingExternalRefs.bookingId, bookings.id))
      .where(eq(bookingExternalRefs.externalCalendarId, calendar.id));
    const reconciliation = reconcileExternalEvents(existingRows.map((row) => ({
      externalId: row.externalId,
      title: row.title ?? "Внешнее бронирование",
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status
    })), events);
    const existingByUid = new Map(existingRows.map((row) => [row.externalId, row]));
    const updatedUids = new Set(reconciliation.update.map((event) => event.externalId));
    let imported = 0;
    let updated = 0;
    let removed = 0;
    let conflicts = 0;

    for (const event of events) {
      const rawPayload = { uid: event.externalId, summary: event.title, dtstart: event.checkIn, dtend: event.checkOut, ical: event.rawPayload, calendarBytes: body.length };
      const existing = existingByUid.get(event.externalId);

      const overlap = await findOverlap(calendar.houseId, event, existing?.bookingId);
      if (overlap) {
        if (await recordConflict(calendar, event, { ...rawPayload, conflictingBooking: overlap.publicNumber })) conflicts++;
        continue;
      }

      if (existing) {
        await db.transaction(async (tx) => {
          if (updatedUids.has(event.externalId)) {
            await tx.update(bookings).set({
              checkIn: event.checkIn,
              checkOut: event.checkOut,
              status: "external",
              source: calendar.provider,
              externalId: event.externalId,
              externalSource: calendar.provider,
              managerComment: event.title,
              updatedAt: syncStartedAt
            }).where(eq(bookings.id, existing.bookingId));
          }
          await tx.update(bookingExternalRefs).set({
            rawPayload,
            lastSyncedAt: syncStartedAt,
            updatedAt: syncStartedAt
          }).where(eq(bookingExternalRefs.id, existing.refId));
        });
        if (updatedUids.has(event.externalId)) updated++;
        continue;
      }

      await db.transaction(async (tx) => {
        const externalEmail = `calendar-${calendar.id}@external.invalid`;
        const [customer] = await tx.insert(customers).values({
          firstName: "Внешнее бронирование",
          lastName: calendar.name,
          email: externalEmail,
          phone: "не указан",
          notes: event.title
        }).onConflictDoUpdate({
          target: customers.email,
          set: { notes: event.title, updatedAt: syncStartedAt }
        }).returning({ id: customers.id });
        const [booking] = await tx.insert(bookings).values({
          publicNumber: `EXT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          houseId: calendar.houseId,
          customerId: customer.id,
          checkIn: event.checkIn,
          checkOut: event.checkOut,
          guests: 1,
          status: "external",
          source: calendar.provider,
          totalAmount: "0",
          externalId: event.externalId,
          externalSource: calendar.provider,
          managerComment: event.title
        }).returning({ id: bookings.id });
        await tx.insert(bookingExternalRefs).values({
          bookingId: booking.id,
          provider: calendar.provider,
          externalId: event.externalId,
          externalUid: event.externalId,
          externalCalendarId: calendar.id,
          rawPayload,
          lastSyncedAt: syncStartedAt
        });
      });
      imported++;
    }

    const removedIds = new Set(reconciliation.remove.map((event) => event.externalId));
    const missingBookingIds = existingRows.filter((row) => removedIds.has(row.externalId)).map((row) => row.bookingId);
    if (missingBookingIds.length) {
      await db.update(bookings).set({ status: "import_removed", updatedAt: syncStartedAt })
        .where(inArray(bookings.id, missingBookingIds));
      removed = missingBookingIds.length;
    }

    await db.transaction(async (tx) => {
      await tx.update(externalCalendars).set({
        lastSyncAt: syncStartedAt,
        lastSuccessAt: syncStartedAt,
        lastError: null,
        updatedAt: syncStartedAt
      }).where(eq(externalCalendars.id, calendar.id));
      if (calendar.integrationId) {
        await tx.update(integrations).set({
          lastSyncedAt: syncStartedAt,
          importedCount: sql`${integrations.importedCount} + ${imported}`,
          updatedAt: syncStartedAt
        }).where(eq(integrations.id, calendar.integrationId));
      }
    });
    const result = { imported, updated, removed, conflicts, total: events.length };
    await logEvent(calendar, conflicts ? "warning" : "info", "iCal synchronization completed", result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown synchronization error";
    await db.update(externalCalendars).set({ lastSyncAt: syncStartedAt, lastError: message, updatedAt: syncStartedAt })
      .where(eq(externalCalendars.id, calendar.id));
    if (calendar.integrationId) {
      await db.update(integrations).set({
        lastSyncedAt: syncStartedAt,
        errorCount: sql`${integrations.errorCount} + 1`,
        updatedAt: syncStartedAt
      }).where(eq(integrations.id, calendar.integrationId));
    }
    await logEvent(calendar, "error", message);
    throw error;
  }
}

export async function syncIcalIntegration(integrationId: string) {
  const [calendar] = await db.select({ id: externalCalendars.id })
    .from(externalCalendars)
    .where(and(eq(externalCalendars.integrationId, integrationId), eq(externalCalendars.isActive, true)))
    .limit(1);
  if (!calendar) throw new Error("No active calendar exists for this integration");
  return syncExternalCalendar(calendar.id);
}
