import {
  adminNotifications,
  db,
  notificationLogs,
  notificationPreferences,
  pushSubscriptions,
  roles,
  users
} from "@judilen/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import webpush from "web-push";
import { notificationEventTypes, type NotificationEventType } from "./notification-types";
import { ensureVapidConfiguration } from "./vapid";
import { safeErrorForLog } from "./redaction";

type NotificationInput = {
  eventType: NotificationEventType;
  title: string;
  href?: string;
  bookingId?: string;
  dedupeKey: string;
  userIds?: string[];
};

async function configureWebPush() {
  await ensureVapidConfiguration();
}

async function eligibleUsers(userIds?: string[]) {
  if (userIds && !userIds.length) return [];
  return db.select({ id: users.id })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(
      eq(users.isActive, true),
      ne(roles.name, "client"),
      userIds?.length ? inArray(users.id, userIds) : undefined
    ));
}

async function deliverPush(userId: string, payload: string) {
  try {
    await configureWebPush();
  } catch (error) {
    console.error("vapid_configuration_failed", safeErrorForLog(error));
    return {
      status: "disabled",
      error: error instanceof Error ? error.message : "VAPID keys are not configured"
    };
  }
  const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (!subscriptions.length) return { status: "skipped", error: "No active push subscriptions" };

  let sent = false;
  const errors: string[] = [];
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth }
      }, payload, { TTL: 300 });
      sent = true;
      await db.update(pushSubscriptions)
        .set({ lastUsedAt: new Date() })
        .where(eq(pushSubscriptions.id, subscription.id));
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      }
      errors.push(error instanceof Error ? error.message : "Push delivery failed");
    }
  }
  return sent
    ? { status: "sent", error: errors.length ? errors.join("; ") : null }
    : { status: "failed", error: errors.join("; ") || "Push delivery failed" };
}

export async function createAdminNotification(input: NotificationInput) {
  try {
    const recipients = await eligibleUsers(input.userIds);
    for (const recipient of recipients) {
      const [created] = await db.insert(adminNotifications).values({
        userId: recipient.id,
        eventType: input.eventType,
        title: input.title,
        href: input.href,
        bookingId: input.bookingId,
        dedupeKey: input.dedupeKey
      }).onConflictDoNothing().returning({ id: adminNotifications.id });
      if (!created) continue;

      const [preference] = await db.select().from(notificationPreferences)
        .where(eq(notificationPreferences.userId, recipient.id))
        .limit(1);
      const eventTypes = preference?.eventTypes ?? [...notificationEventTypes];
      const shouldPush = Boolean(preference?.pushEnabled && eventTypes.includes(input.eventType));
      const result = shouldPush
        ? await deliverPush(recipient.id, JSON.stringify({
            title: input.title,
            body: "Откройте админку, чтобы посмотреть подробности.",
            url: input.href ?? "/admin"
          }))
        : { status: "skipped", error: preference?.pushEnabled ? "Event is disabled" : "Push is disabled" };

      await db.insert(notificationLogs).values({
        userId: recipient.id,
        eventType: input.eventType,
        bookingId: input.bookingId,
        status: result.status,
        dedupeKey: input.dedupeKey,
        sentAt: result.status === "sent" ? new Date() : null,
        errorMessage: result.error
      }).onConflictDoNothing();
    }
  } catch (error) {
    console.error("admin_notification_failed", { eventType: input.eventType, error: safeErrorForLog(error) });
  }
}
