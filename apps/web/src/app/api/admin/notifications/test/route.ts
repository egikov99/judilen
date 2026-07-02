import { createAdminNotification } from "@/lib/admin-notifications";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  await createAdminNotification({
    eventType: "booking_created",
    title: "Тестовое уведомление",
    href: "/admin/settings",
    dedupeKey: `test:${crypto.randomUUID()}`,
    userIds: [auth.session.userId]
  });
  return Response.json({ ok: true });
}
