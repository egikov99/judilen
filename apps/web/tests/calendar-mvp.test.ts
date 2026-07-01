import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCalendarExportUrl } from "@/lib/calendar-links";

describe("calendar integration MVP", () => {
  it("builds the protected CRM export URL", () => {
    expect(buildCalendarExportUrl("https://judilen.example/", "house-1", "secret token")).toBe(
      "https://judilen.example/api/ical/houses/house-1.ics?token=secret%20token"
    );
  });

  it("enforces overlap protection for CRM, external bookings and blocks", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../packages/db/migrations/0002_external_calendars.sql"), "utf8");
    expect(migration).toContain('CONSTRAINT "bookings_no_overlap"');
    expect(migration).toContain("'external'");
    expect(migration).toContain("'blocked'");
    expect(migration).toContain("EXCLUDE USING gist");
    expect(migration).toContain('daterange("check_in", "check_out", \'[)\') WITH &&');
  });
});
