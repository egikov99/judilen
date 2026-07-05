import "server-only";

import { db, securityRateLimits } from "@judilen/db";
import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  identifier?: string | null;
};

function requestAddress(request: Request) {
  const value = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || "unknown";
  return value.trim().slice(0, 100);
}

export async function checkRateLimit(request: Request, options: RateLimitOptions) {
  const identity = `${requestAddress(request)}:${options.identifier?.trim().toLowerCase().slice(0, 254) ?? ""}`;
  const keyHash = createHash("sha256").update(`${options.scope}:${identity}`).digest("hex");
  const now = new Date();
  const resetBefore = new Date(now.getTime() - options.windowMs);
  const [row] = await db.insert(securityRateLimits).values({
    keyHash,
    windowStartedAt: now,
    requestCount: 1,
    updatedAt: now
  }).onConflictDoUpdate({
    target: securityRateLimits.keyHash,
    set: {
      requestCount: sql`case when ${securityRateLimits.windowStartedAt} <= ${resetBefore} then 1 else ${securityRateLimits.requestCount} + 1 end`,
      windowStartedAt: sql`case when ${securityRateLimits.windowStartedAt} <= ${resetBefore} then ${now} else ${securityRateLimits.windowStartedAt} end`,
      updatedAt: now
    }
  }).returning({
    count: securityRateLimits.requestCount,
    windowStartedAt: securityRateLimits.windowStartedAt
  });

  if (Math.random() < 0.01) {
    void db.delete(securityRateLimits)
      .where(lt(securityRateLimits.updatedAt, new Date(now.getTime() - 86_400_000)))
      .catch(() => undefined);
  }
  const retryAfter = Math.max(1, Math.ceil(
    (row.windowStartedAt.getTime() + options.windowMs - now.getTime()) / 1000
  ));
  const allowed = row.count <= options.limit;
  if (!allowed) console.warn("security_rate_limit_exceeded", { scope: options.scope, keyHash });
  return { allowed, retryAfter };
}

export function rateLimitProblem(retryAfter: number) {
  return Response.json({
    type: "about:blank",
    title: "Слишком много запросов",
    status: 429,
    detail: "Подождите и повторите попытку."
  }, {
    status: 429,
    headers: {
      "Content-Type": "application/problem+json",
      "Retry-After": String(retryAfter),
      "Cache-Control": "no-store"
    }
  });
}
