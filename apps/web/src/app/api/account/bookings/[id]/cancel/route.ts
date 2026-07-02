import { bookingStatusHistory, bookings, customers, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createAdminNotification } from "@/lib/admin-notifications";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({ reason: z.string().trim().min(3).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Укажите причину отмены");
  const { id } = await params;
  const [booking] = await db.select({
    id: bookings.id,
    status: bookings.status,
    checkIn: bookings.checkIn
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(eq(bookings.id, id), eq(customers.userId, session.userId)))
    .limit(1);
  if (!booking) return problem(404, "Бронирование не найдено");
  if (!["new", "awaiting_confirmation", "confirmed", "awaiting_payment"].includes(booking.status)) {
    return problem(409, "Это бронирование нельзя отменить самостоятельно");
  }
  const daysBefore = (Date.parse(booking.checkIn) - Date.now()) / 86_400_000;
  if (daysBefore < 7) return problem(409, "Для отмены менее чем за 7 дней свяжитесь с администратором");
  await db.transaction(async (tx) => {
    await tx.update(bookings).set({
      status: "cancelled",
      cancellationReason: parsed.data.reason,
      updatedAt: new Date()
    }).where(eq(bookings.id, id));
    await tx.insert(bookingStatusHistory).values({
      bookingId: id,
      fromStatus: booking.status,
      toStatus: "cancelled",
      changedBy: session.userId,
      comment: parsed.data.reason
    });
  });
  await createAdminNotification({
    eventType: "booking_cancelled",
    title: "Отмена бронирования",
    bookingId: id,
    href: "/admin/bookings",
    dedupeKey: `booking-cancelled:${id}`
  });
  return Response.json({ ok: true });
}
