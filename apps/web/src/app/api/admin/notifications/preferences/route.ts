import { db, notificationPreferences, pushSubscriptions } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { notificationEventTypes } from "@/lib/notification-types";
import { requirePermission } from "@/lib/session";
import { ensureVapidConfiguration } from "@/lib/vapid";
import { problem } from "@/lib/validation";

const preferenceSchema = z.object({
  pushEnabled: z.boolean(),
  eventTypes: z.array(z.enum(notificationEventTypes)),
  reminderHours: z.coerce.number().int().min(1).max(168)
});

export async function GET() {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [[preference], [subscription], vapid] = await Promise.all([
    db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, auth.session.userId)).limit(1),
    db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, auth.session.userId)).limit(1),
    ensureVapidConfiguration().catch(() => null)
  ]);
  return Response.json({
    preference: preference ?? {
      userId: auth.session.userId,
      pushEnabled: false,
      eventTypes: [...notificationEventTypes],
      reminderHours: 24
    },
    subscribed: Boolean(subscription),
    vapidPublicKey: vapid?.publicKey ?? null
  });
}

export async function PATCH(request: Request) {
  const auth = await requirePermission("dashboard.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = preferenceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные настройки", parsed.error.flatten());
  const [preference] = await db.insert(notificationPreferences)
    .values({ userId: auth.session.userId, ...parsed.data })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: { ...parsed.data, updatedAt: new Date() }
    })
    .returning();
  return Response.json({ preference });
}
