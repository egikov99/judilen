import { adminNotifications, db } from "@judilen/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");

  const [items, [count]] = await Promise.all([
    db.select().from(adminNotifications)
      .where(eq(adminNotifications.userId, auth.session.userId))
      .orderBy(desc(adminNotifications.createdAt))
      .limit(40),
    db.select({ value: sql<number>`count(*)::int` }).from(adminNotifications).where(and(
      eq(adminNotifications.userId, auth.session.userId),
      isNull(adminNotifications.readAt)
    ))
  ]);
  return Response.json({ items, unreadCount: count?.value ?? 0 });
}
