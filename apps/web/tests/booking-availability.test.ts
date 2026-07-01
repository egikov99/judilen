import { describe, expect, it } from "vitest";
import {
  blockingBookingStatuses,
  dateRangesOverlap,
  hasDatabaseErrorCode
} from "@/lib/booking-availability";

describe("booking availability", () => {
  const occupiedCases = [
    {
      name: "booking is fully inside the search period",
      booking: ["2026-07-03", "2026-07-04"],
      search: ["2026-07-02", "2026-07-05"]
    },
    {
      name: "search period is fully inside the booking",
      booking: ["2026-07-02", "2026-07-05"],
      search: ["2026-07-03", "2026-07-04"]
    },
    {
      name: "search overlaps the beginning of the booking",
      booking: ["2026-07-03", "2026-07-05"],
      search: ["2026-07-02", "2026-07-04"]
    },
    {
      name: "search overlaps the end of the booking",
      booking: ["2026-07-02", "2026-07-04"],
      search: ["2026-07-03", "2026-07-05"]
    },
    {
      name: "search exactly matches the booking",
      booking: ["2026-07-03", "2026-07-05"],
      search: ["2026-07-03", "2026-07-05"]
    }
  ] as const;

  for (const scenario of occupiedCases) {
    it(`detects overlap when ${scenario.name}`, () => {
      expect(dateRangesOverlap(
        scenario.search[0],
        scenario.search[1],
        scenario.booking[0],
        scenario.booking[1]
      )).toBe(true);
    });
  }

  it("allows checkout on the next booking check-in date", () => {
    expect(dateRangesOverlap("2026-07-03", "2026-07-05", "2026-07-05", "2026-07-07")).toBe(false);
  });

  it("allows check-in on the previous booking checkout date", () => {
    expect(dateRangesOverlap("2026-07-05", "2026-07-07", "2026-07-03", "2026-07-05")).toBe(false);
  });

  it("uses the same statuses as the database overlap constraint", () => {
    const statuses: readonly string[] = blockingBookingStatuses;
    expect(statuses).toEqual([
      "pending",
      "awaiting_confirmation",
      "confirmed",
      "awaiting_payment",
      "paid",
      "external",
      "blocked"
    ]);
    for (const inactive of ["cancelled", "declined", "import_removed", "completed", "new"]) {
      expect(statuses).not.toContain(inactive);
    }
  });

  it("detects exclusion violations wrapped by the database client", () => {
    expect(hasDatabaseErrorCode({ cause: { code: "23P01" } }, "23P01")).toBe(true);
    expect(hasDatabaseErrorCode({ cause: { code: "23505" } }, "23P01")).toBe(false);
  });
});
