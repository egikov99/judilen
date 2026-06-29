import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider, IcalAdapter, rangesOverlap } from "@judilen/integrations";

afterEach(() => vi.unstubAllEnvs());

describe("iCal adapter", () => {
  it("exports and imports blocked date ranges", async () => {
    const adapter = new IcalAdapter();
    const events = [{ externalId: "booking-1", title: "Занято", checkIn: "2026-07-12", checkOut: "2026-07-15", source: "judilen" }];
    const calendar = await adapter.exportCalendar(events);
    expect(calendar).toContain("DTSTART;VALUE=DATE:20260712");
    await expect(adapter.importCalendar(calendar)).resolves.toEqual([{ ...events[0], source: "ical" }]);
  });

  it("treats checkout as an exclusive boundary", () => {
    expect(rangesOverlap("2026-07-12", "2026-07-15", "2026-07-14", "2026-07-18")).toBe(true);
    expect(rangesOverlap("2026-07-12", "2026-07-15", "2026-07-15", "2026-07-18")).toBe(false);
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
