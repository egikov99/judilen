import { bookingStatusHistory, bookings, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { createAdminNotification } from "@/lib/admin-notifications";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { bookingUpdateSchema, problem } from "@/lib/validation";
import { sendBookingCustomerEmail } from "@/lib/booking-emails";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("bookings.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = bookingUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!before) return problem(404, "Бронирование не найдено");
  const { paidAmount, ...data } = parsed.data;
  const [after] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(bookings).set({
      ...data,
      ...(paidAmount === undefined ? {} : { paidAmount: String(paidAmount) }),
      ...(parsed.data.status === "paid" ? { paymentStatus: "paid" } : {}),
      updatedAt: new Date()
    }).where(eq(bookings.id, id)).returning();
    if (parsed.data.status && parsed.data.status !== before.status) {
      await tx.insert(bookingStatusHistory).values({
        bookingId: id,
        fromStatus: before.status,
        toStatus: parsed.data.status,
        changedBy: auth.session.userId,
        comment: parsed.data.managerComment ?? undefined
      });
    }
    return [updated];
  });
  await writeAudit({ session: auth.session, request, action: "booking.update", entityType: "booking", entityId: id, before, after });
  if (parsed.data.status === "confirmed" && before.status !== "confirmed") {
    await sendBookingCustomerEmail(id, "booking_confirmed", "booking-confirmed");
  } else if (parsed.data.status === "cancelled" && before.status !== "cancelled") {
    await sendBookingCustomerEmail(id, "booking_cancelled", "booking-cancelled");
  } else if (Object.keys(parsed.data).some((key) => key !== "managerComment")) {
    await sendBookingCustomerEmail(id, "booking_changed", `booking-changed:${after.updatedAt.toISOString()}`);
  }
  if (parsed.data.status === "cancelled" && before.status !== "cancelled") {
    await createAdminNotification({
      eventType: "booking_cancelled",
      title: "Отмена бронирования",
      bookingId: id,
      href: "/admin/bookings",
      dedupeKey: `booking-cancelled:${id}`
    });
  } else if (parsed.data.status === "paid" || paidAmount !== undefined) {
    await createAdminNotification({
      eventType: "payment_status",
      title: "Изменение статуса оплаты",
      bookingId: id,
      href: "/admin/bookings",
      dedupeKey: `payment-status:booking:${id}:${after.updatedAt.toISOString()}`
    });
  }
  return Response.json({ item: after });
}
