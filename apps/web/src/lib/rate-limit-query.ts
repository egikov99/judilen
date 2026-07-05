import type { db as productionDb } from "@judilen/db";
import { securityRateLimits } from "@judilen/db/schema";
import { sql } from "drizzle-orm";
import type { rateLimitTimestamps } from "@/lib/rate-limit-time";

type Database = Omit<typeof productionDb, "$client">;
type Timestamps = ReturnType<typeof rateLimitTimestamps>;

export function buildRateLimitUpsert(database: Database, keyHash: string, timestamps: Timestamps) {
  const currentTimestamp = sql<Date>`${timestamps.currentTime}::timestamptz`;
  const windowBoundary = sql<Date>`${timestamps.windowBoundary}::timestamptz`;

  return database.insert(securityRateLimits).values({
    keyHash,
    windowStartedAt: currentTimestamp,
    requestCount: 1,
    updatedAt: currentTimestamp
  }).onConflictDoUpdate({
    target: securityRateLimits.keyHash,
    set: {
      requestCount: sql`case when ${securityRateLimits.windowStartedAt} <= ${windowBoundary} then 1 else ${securityRateLimits.requestCount} + 1 end`,
      windowStartedAt: sql`case when ${securityRateLimits.windowStartedAt} <= ${windowBoundary} then ${currentTimestamp} else ${securityRateLimits.windowStartedAt} end`,
      updatedAt: currentTimestamp
    }
  }).returning({
    count: securityRateLimits.requestCount,
    windowStartedAt: securityRateLimits.windowStartedAt
  });
}

export function buildRateLimitCleanup(database: Database, timestamps: Timestamps) {
  const cleanupBoundary = sql<Date>`${timestamps.cleanupBoundary}::timestamptz`;
  return database.delete(securityRateLimits)
    .where(sql`${securityRateLimits.updatedAt} < ${cleanupBoundary}`);
}
