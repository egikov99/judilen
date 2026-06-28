import { bookingStatusHistory, bookings, customers, db, payments } from "@judilen/db";
import { getPaymentProvider } from "@judilen/integrations";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({ bookingId: z.uuid() });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный bookingId");
  const conditions = [eq(bookings.id, parsed.data.bookingId)];
  if (session.role === "client") conditions.push(eq(customers.userId, session.userId));
  const [booking] = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    status: bookings.status
  }).from(bookings).innerJoin(customers, eq(bookings.customerId, customers.id)).where(and(...conditions)).limit(1);
  if (!booking) return problem(404, "Бронирование не найдено");
  const amount = Math.max(0, Number(booking.totalAmount) - Number(booking.paidAmount));
  if (!amount) return problem(409, "Бронирование уже оплачено");
  const provider = getPaymentProvider();
  const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [payment] = await db.insert(payments).values({
    bookingId: booking.id,
    provider: provider.name,
    amount: String(amount),
    currency: "RUB"
  }).returning();
  try {
    const created = await provider.createPayment({
      idempotenceKey: payment.id,
      amount: amount.toFixed(2),
      currency: "RUB",
      description: `Бронирование ${booking.publicNumber}`,
      returnUrl: `${base}/oplata/${booking.id}/uspeh`
    });
    await db.transaction(async (tx) => {
      await tx.update(payments).set({
        providerPaymentId: created.providerPaymentId,
        status: created.status,
        updatedAt: new Date()
      }).where(eq(payments.id, payment.id));
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
    return Response.json({ confirmationUrl: created.confirmationUrl });
  } catch (error) {
    await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, payment.id));
    return problem(503, "Платежный сервис недоступен", error instanceof Error ? error.message : undefined);
  }
}

