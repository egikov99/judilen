import { bookingStatusHistory, bookings, customers, db, payments } from "@judilen/db";
import { getPaymentProvider } from "@judilen/integrations";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createAdminNotification } from "@/lib/admin-notifications";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";
import { onlinePaymentsEnabled } from "@/lib/payments";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { safeErrorForLog } from "@/lib/redaction";

const schema = z.object({ bookingId: z.uuid() });

export async function POST(request: Request) {
  if (!onlinePaymentsEnabled()) {
    return problem(409, "Онлайн-оплата временно отключена", "Оплата производится по приезду");
  }
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const rate = await checkRateLimit(request, {
    scope: "payment.create",
    limit: 10,
    windowMs: 15 * 60_000,
    identifier: session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный bookingId");
  const [booking] = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    status: bookings.status
  }).from(bookings).innerJoin(customers, eq(bookings.customerId, customers.id)).where(and(
    eq(bookings.id, parsed.data.bookingId),
    eq(customers.userId, session.userId)
  )).limit(1);
  if (!booking) return problem(404, "Бронирование не найдено");
  const amount = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
  if (!amount) return problem(409, "Бронирование уже оплачено");
  const provider = getPaymentProvider();
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [payment] = await db.insert(payments).values({
    bookingId: booking.id,
    provider: provider.name,
    amount: String(amount),
    currency: "BYN"
  }).returning();
  try {
    const created = await provider.createPayment({
      idempotenceKey: payment.id,
      amount: amount.toFixed(2),
      currency: "BYN",
      description: `Бронирование ${booking.publicNumber}`,
      returnUrl: `${base}/oplata/${booking.id}/uspeh`
    });
    await db.transaction(async (tx) => {
      await tx.update(payments).set({
        providerPaymentId: created.providerPaymentId,
        status: created.status,
        updatedAt: new Date()
      }).where(eq(payments.id, payment.id));
      await tx.update(bookings).set({
        paymentMethod: "online",
        paymentStatus: created.status,
        updatedAt: new Date()
      }).where(eq(bookings.id, booking.id));
      if (created.status === "paid") {
        await tx.update(bookings).set({
          paidAmount: booking.totalAmount,
          status: "paid",
          updatedAt: new Date()
        }).where(eq(bookings.id, booking.id));
        await tx.insert(bookingStatusHistory).values({
          bookingId: booking.id,
          fromStatus: booking.status,
          toStatus: "paid",
          changedBy: session.userId,
          comment: "Оплачено через development mock provider"
        });
      }
    });
    await createAdminNotification({
      eventType: "payment_status",
      title: created.status === "paid" ? "Новая оплата" : "Изменение статуса оплаты",
      bookingId: booking.id,
      href: "/admin/bookings",
      dedupeKey: `payment-status:${payment.id}:${created.status}`
    });
    return Response.json({ confirmationUrl: created.confirmationUrl });
  } catch (error) {
    await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, payment.id));
    console.error("payment_provider_failed", { paymentId: payment.id, error: safeErrorForLog(error) });
    return problem(503, "Платежный сервис временно недоступен");
  }
}
