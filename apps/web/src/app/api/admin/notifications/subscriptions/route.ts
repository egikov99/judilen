import { db, notificationPreferences, pushSubscriptions } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const subscriptionSchema = z.object({
  endpoint: z.url().max(4000),
  keys: z.object({
    p256dh: z.string().min(20).max(1000),
    auth: z.string().min(8).max(1000)
  })
});

export async function POST(request: Request) {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, {
    scope: "push.subscription",
    limit: 20,
    windowMs: 60 * 60_000,
    identifier: auth.session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректная push-подписка", parsed.error.flatten());
  const [subscription] = await db.insert(pushSubscriptions).values({
    userId: auth.session.userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: request.headers.get("user-agent")
  }).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: {
      userId: auth.session.userId,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: request.headers.get("user-agent")
    }
  }).returning();
  await db.insert(notificationPreferences).values({
    userId: auth.session.userId,
    pushEnabled: true
  }).onConflictDoUpdate({
    target: notificationPreferences.userId,
    set: { pushEnabled: true, updatedAt: new Date() }
  });
  return Response.json({ subscription: { id: subscription.id, active: true } }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const payload = await request.json().catch(() => ({})) as { endpoint?: string };
  await db.delete(pushSubscriptions).where(and(
    eq(pushSubscriptions.userId, auth.session.userId),
    payload.endpoint ? eq(pushSubscriptions.endpoint, payload.endpoint) : undefined
  ));
  await db.insert(notificationPreferences).values({
    userId: auth.session.userId,
    pushEnabled: false
  }).onConflictDoUpdate({
    target: notificationPreferences.userId,
    set: { pushEnabled: false, updatedAt: new Date() }
  });
  return Response.json({ ok: true });
}
