import { adminNotifications, db } from "@judilen/db";
import { and, eq, isNull } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  await db.update(adminNotifications).set({ readAt: new Date() }).where(and(
    eq(adminNotifications.userId, auth.session.userId),
    isNull(adminNotifications.readAt)
  ));
  return Response.json({ ok: true });
}
