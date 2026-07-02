import { adminNotifications, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [item] = await db.update(adminNotifications)
    .set({ readAt: new Date() })
    .where(and(eq(adminNotifications.id, id), eq(adminNotifications.userId, auth.session.userId)))
    .returning({ id: adminNotifications.id });
  if (!item) return problem(404, "Уведомление не найдено");
  return Response.json({ ok: true });
}
