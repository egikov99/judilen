import "server-only";

import { db } from "@judilen/db";
import { createHash } from "node:crypto";
import { buildRateLimitCleanup, buildRateLimitUpsert } from "@/lib/rate-limit-query";
import { rateLimitTimestamps } from "@/lib/rate-limit-time";

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
  const nowMs = Date.now();
  const timestamps = rateLimitTimestamps(nowMs, options.windowMs);
  const [row] = await buildRateLimitUpsert(db, keyHash, timestamps);

  if (Math.random() < 0.01) {
    void buildRateLimitCleanup(db, timestamps)
      .catch(() => undefined);
  }
  const retryAfter = Math.max(1, Math.ceil(
    (row.windowStartedAt.getTime() + options.windowMs - nowMs) / 1000
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
