import { bookings, db, notificationPreferences, roles, users } from "@judilen/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { createAdminNotification } from "@/lib/admin-notifications";
import { addDays } from "@/lib/date-ranges";
import { problem } from "@/lib/validation";

const arrivalStatuses = ["confirmed", "awaiting_payment", "paid", "external"] as const;

export async function POST(request: Request) {
  const expected = process.env.NOTIFICATION_CRON_SECRET ?? process.env.ICAL_SYNC_CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return problem(401, "Неверная авторизация");
  }

  const preferences = await db.select({
    userId: notificationPreferences.userId,
    reminderHours: notificationPreferences.reminderHours,
    fallbackUserId: users.id
  }).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(notificationPreferences, eq(notificationPreferences.userId, users.id))
    .where(and(eq(users.isActive, true), ne(roles.name, "client")));
  const today = new Date().toISOString().slice(0, 10);
  let queued = 0;

  for (const preference of preferences) {
    const reminderHours = preference.reminderHours ?? 24;
    const offsetDays = reminderHours < 24 ? 0 : Math.ceil(reminderHours / 24);
    const targetDate = addDays(today, offsetDays);
    const rows = await db.select({ id: bookings.id }).from(bookings).where(and(
      eq(bookings.checkIn, targetDate),
      inArray(bookings.status, arrivalStatuses)
    ));
    for (const booking of rows) {
      await createAdminNotification({
        eventType: "arrival_reminder",
        title: offsetDays === 0 ? "Сегодня заселение" : "Скоро заселение",
        bookingId: booking.id,
        href: "/admin/calendar",
        dedupeKey: `arrival:${booking.id}:${targetDate}:${reminderHours}`,
        userIds: [preference.userId ?? preference.fallbackUserId]
      });
      queued++;
    }
  }

  return Response.json({ queued });
}
