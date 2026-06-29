import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider, IcalAdapter, rangesOverlap, reconcileExternalEvents } from "@judilen/integrations";

afterEach(() => vi.unstubAllEnvs());

describe("iCal adapter", () => {
  it("exports and imports blocked date ranges", async () => {
    const adapter = new IcalAdapter();
    const events = [{ externalId: "booking-1", title: "Занято", checkIn: "2026-07-12", checkOut: "2026-07-15", source: "judilen" }];
    const calendar = await adapter.exportCalendar(events);
    expect(calendar).toContain("DTSTART;VALUE=DATE:20260712");
    const imported = await adapter.importCalendar(calendar);
    expect(imported).toMatchObject([{ ...events[0], source: "ical" }]);
    expect(imported[0].rawPayload).toContain("BEGIN:VEVENT");
  });

  it("treats checkout as an exclusive boundary", () => {
    expect(rangesOverlap("2026-07-12", "2026-07-15", "2026-07-14", "2026-07-18")).toBe(true);
    expect(rangesOverlap("2026-07-12", "2026-07-15", "2026-07-15", "2026-07-18")).toBe(false);
  });

  it("does not create duplicates and detects updates and removed events", () => {
    const existing = [
      { externalId: "same", title: "Занято", checkIn: "2026-07-12", checkOut: "2026-07-15", status: "external" },
      { externalId: "changed", title: "Старое", checkIn: "2026-07-20", checkOut: "2026-07-22", status: "external" },
      { externalId: "removed", title: "Удалено", checkIn: "2026-08-01", checkOut: "2026-08-03", status: "external" }
    ];
    const incoming = [
      { externalId: "same", title: "Занято", checkIn: "2026-07-12", checkOut: "2026-07-15", source: "ical" },
      { externalId: "changed", title: "Новое", checkIn: "2026-07-21", checkOut: "2026-07-24", source: "ical" },
      { externalId: "new", title: "Новое событие", checkIn: "2026-08-10", checkOut: "2026-08-12", source: "ical" }
    ];
    const result = reconcileExternalEvents(existing, incoming);
    expect(result.create.map((event) => event.externalId)).toEqual(["new"]);
    expect(result.update.map((event) => event.externalId)).toEqual(["changed"]);
    expect(result.remove.map((event) => event.externalId)).toEqual(["removed"]);
  });
});

describe("payment provider safety", () => {
  it("cannot use the mock provider in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(getPaymentProvider("mock").createPayment({
      idempotenceKey: "key",
      amount: "100.00",
      currency: "BYN",
      description: "test",
      returnUrl: "https://example.com/return"
    })).rejects.toThrow("disabled in production");
  });
});
