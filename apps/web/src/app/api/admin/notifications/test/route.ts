import { createAdminNotification } from "@/lib/admin-notifications";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, {
    scope: "push.test",
    limit: 10,
    windowMs: 10 * 60_000,
    identifier: auth.session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  await createAdminNotification({
    eventType: "booking_created",
    title: "Тестовое уведомление",
    href: "/admin/settings",
    dedupeKey: `test:${crypto.randomUUID()}`,
    userIds: [auth.session.userId]
  });
  return Response.json({ ok: true });
}
