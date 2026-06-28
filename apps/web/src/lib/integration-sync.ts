import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  bookings,
  customers,
  db,
  integrationLogs,
  integrations
} from "@judilen/db";
import { IcalAdapter } from "@judilen/integrations";
import { and, eq } from "drizzle-orm";

function isPrivateAddress(address: string) {
  const normalized = address.replace(/^::ffff:/, "");
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const lower = normalized.toLowerCase();
  return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb");
}

async function assertSafeUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Integration config.url is required");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only credential-free HTTPS URLs are allowed");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private network destinations are not allowed");
  return url;
}

export async function syncIcalIntegration(integrationId: string) {
  const [integration] = await db.select().from(integrations).where(eq(integrations.id, integrationId)).limit(1);
  if (!integration || integration.kind !== "ical" || !integration.isEnabled || !integration.houseId) {
    throw new Error("Enabled iCal integration with a house is required");
  }
  try {
    const url = await assertSafeUrl(integration.config.url);
    const response = await fetch(url, {
      headers: { Accept: "text/calendar" },
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Calendar returned HTTP ${response.status}`);
    const body = await response.text();
    if (body.length > 5_000_000) throw new Error("Calendar exceeds 5 MB");
    const events = await new IcalAdapter().importCalendar(body);
    let imported = 0;
    let updated = 0;
    let conflicts = 0;
    for (const event of events) {
      try {
        const [existing] = await db.select().from(bookings).where(and(
          eq(bookings.externalSource, `ical:${integration.id}`),
          eq(bookings.externalId, event.externalId)
        )).limit(1);
        if (existing) {
          await db.update(bookings).set({
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            updatedAt: new Date()
          }).where(eq(bookings.id, existing.id));
          updated++;
          continue;
        }
        await db.transaction(async (tx) => {
          const externalEmail = `ical-${integration.id}@external.invalid`;
          const [customer] = await tx.insert(customers).values({
            firstName: "Внешнее бронирование",
            lastName: integration.name,
            email: externalEmail,
            phone: "не указан",
            notes: event.title
          }).onConflictDoUpdate({
            target: customers.email,
            set: { notes: event.title, updatedAt: new Date() }
          }).returning({ id: customers.id });
          await tx.insert(bookings).values({
            publicNumber: `EXT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
            houseId: integration.houseId!,
            customerId: customer.id,
            checkIn: event.checkIn,
            checkOut: event.checkOut,
            guests: 1,
            status: "confirmed",
            totalAmount: "0",
            externalId: event.externalId,
            externalSource: `ical:${integration.id}`
          });
        });
        imported++;
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "23P01") {
          conflicts++;
          continue;
        }
        throw error;
      }
    }
    await db.transaction(async (tx) => {
      await tx.update(integrations).set({ lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(integrations.id, integration.id));
      await tx.insert(integrationLogs).values({
        integrationId: integration.id,
        level: conflicts ? "warning" : "info",
        message: "iCal synchronization completed",
        context: { imported, updated, conflicts, total: events.length }
      });
    });
    return { imported, updated, conflicts, total: events.length };
  } catch (error) {
    await db.insert(integrationLogs).values({
      integrationId: integration.id,
      level: "error",
      message: error instanceof Error ? error.message : "Unknown synchronization error"
    });
    throw error;
  }
}
