import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as schema from "@judilen/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import { buildRateLimitCleanup, buildRateLimitUpsert } from "@/lib/rate-limit-query";
import { rateLimitTimestamps } from "@/lib/rate-limit-time";

describe("persistent rate limit timestamps", () => {
  it("converts every database timestamp parameter to an ISO string", () => {
    const timestamps = rateLimitTimestamps(Date.UTC(2026, 6, 6, 0, 0, 0), 15 * 60_000);

    expect(timestamps).toEqual({
      currentTime: "2026-07-06T00:00:00.000Z",
      windowBoundary: "2026-07-05T23:45:00.000Z",
      cleanupBoundary: "2026-07-05T00:00:00.000Z"
    });
    for (const parameter of Object.values(timestamps)) {
      expect(typeof parameter).toBe("string");
      expect(parameter).not.toBeInstanceOf(Date);
    }
  });

  it("does not bind Date objects in upsert or cleanup query params", () => {
    const database = drizzle.mock({ schema });
    const timestamps = rateLimitTimestamps(Date.UTC(2026, 6, 6, 0, 0, 0), 15 * 60_000);
    const queries = [
      buildRateLimitUpsert(database, "rate-limit-key", timestamps).toSQL(),
      buildRateLimitCleanup(database, timestamps).toSQL()
    ];

    const parameters = queries.flatMap((query) => query.params);
    expect(parameters.some((parameter) => parameter instanceof Date)).toBe(false);
    expect(parameters).toContain(timestamps.currentTime);
    expect(parameters).toContain(timestamps.windowBoundary);
    expect(parameters).toContain(timestamps.cleanupBoundary);

    const source = readFileSync(resolve(process.cwd(), "src/lib/rate-limit-query.ts"), "utf8");
    expect(source).toContain("::timestamptz");
  });
});
