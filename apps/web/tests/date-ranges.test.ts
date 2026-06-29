import { describe, expect, it } from "vitest";
import { dashboardRange, periodRange, shiftRange, validateDateRange } from "@/lib/date-ranges";

describe("admin date ranges", () => {
  it("validates calendar startDate and endDate", () => {
    expect(validateDateRange("2026-07-01", "2026-07-31")).toEqual({ startDate: "2026-07-01", endDate: "2026-07-31", days: 31 });
    expect(validateDateRange("2026-07-31", "2026-07-01")).toBeNull();
    expect(validateDateRange(null, "2026-07-01")).toBeNull();
  });

  it("moves to the next period without changing its length", () => {
    expect(shiftRange("2026-07-01", "2026-07-14", 1)).toEqual({ startDate: "2026-07-15", endDate: "2026-07-28" });
  });

  it("supports calendar and dashboard presets", () => {
    expect(periodRange("month", "2026-07-19")).toEqual({ startDate: "2026-07-01", endDate: "2026-07-31" });
    expect(dashboardRange("previous_month", "2026-07-19")).toEqual({ startDate: "2026-06-01", endDate: "2026-06-30" });
    expect(dashboardRange("year", "2026-07-19")).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
  });
});
