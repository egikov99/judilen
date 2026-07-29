import { bookingServices, bookingStatusHistory, bookings, customers, db, houses, salesChannels } from "@judilen/db";
import { eq, sql } from "drizzle-orm";
import { createAdminNotification } from "@/lib/admin-notifications";
import { bookingServicesTotal, getBookingServicesMap, resolveBookingServiceLines } from "@/lib/booking-services";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { bookingUpdateSchema, problem } from "@/lib/validation";
import { sendBookingCustomerEmail } from "@/lib/booking-emails";
import { roundMoney } from "@/lib/weekday-prices";

async function authorize(permission: "bookings.read" | "bookings.update") {
  const auth = await requirePermission(permission);
  if (auth.error === "unauthorized") return { response: problem(401, "Требуется авторизация") } as const;
  if (auth.error === "forbidden") return { response: problem(403, "Недостаточно прав") } as const;
  return { auth } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorized = await authorize("bookings.read");
  if ("response" in authorized) return authorized.response;
  const { id } = await params;
  const [item] = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    houseId: bookings.houseId,
    houseName: houses.name,
    customerId: bookings.customerId,
    customerFirstName: customers.firstName,
    customerLastName: customers.lastName,
    customerEmail: customers.email,
    customerPhone: customers.phone,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    guests: bookings.guests,
    status: bookings.status,
    source: bookings.source,
    accommodationAmount: bookings.accommodationAmount,
    totalAmount: bookings.totalAmount,
    paidAmount: bookings.paidAmount,
    paymentStatus: bookings.paymentStatus,
    salesChannelId: bookings.salesChannelId,
    salesChannelName: salesChannels.name,
    managerComment: bookings.managerComment,
    cancellationReason: bookings.cancellationReason
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .leftJoin(salesChannels, eq(bookings.salesChannelId, salesChannels.id))
    .where(eq(bookings.id, id))
    .limit(1);
  if (!item) return problem(404, "Бронирование не найдено");
  const serviceMap = await getBookingServicesMap([id]);
  const itemServices = serviceMap.get(id) ?? [];
  return Response.json({ item: { ...item, servicesTotal: bookingServicesTotal(itemServices), services: itemServices } });
}

async function updateBooking(request: Request, context: { params: Promise<{ id: string }> }) {
  const authorized = await authorize("bookings.update");
  if ("response" in authorized) return authorized.response;
  const parsed = bookingUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await context.params;
  const [before] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!before) return problem(404, "Бронирование не найдено");
  if (parsed.data.salesChannelId) {
    const [channel] = await db.select({ id: salesChannels.id }).from(salesChannels)
      .where(eq(salesChannels.id, parsed.data.salesChannelId)).limit(1);
    if (!channel) return problem(422, "Канал продаж не найден");
  }

  const existingServices = parsed.data.services
    ? (await getBookingServicesMap([id])).get(id) ?? []
    : [];
  const catalogResolution = parsed.data.services
    ? await resolveBookingServiceLines(parsed.data.services, before.houseId, existingServices)
    : null;
  const resolved = catalogResolution ? {
    ...catalogResolution,
    lines: catalogResolution.lines.map((line) => {
      const existing = existingServices.find((item) => (
        item.serviceId === line.serviceId && item.serviceOptionId === line.serviceOptionId
      ));
      return existing ? {
        ...line,
        title: existing.title,
        optionTitle: existing.optionTitle,
        priceUnit: existing.priceUnit,
        unitPrice: existing.unitPrice,
        totalPrice: roundMoney(existing.unitPrice * line.quantity)
      } : line;
    })
  } : null;
  if (resolved?.invalid) return problem(422, "Выбранная услуга или вариант недоступны для этого домика");
  const [currentServiceTotal] = resolved ? [] : await db.select({
    total: sql<string>`coalesce(sum(${bookingServices.totalPrice}), 0)`
  }).from(bookingServices).where(eq(bookingServices.bookingId, id));
  const servicesTotal = resolved
    ? bookingServicesTotal(resolved.lines)
    : Number(currentServiceTotal?.total ?? 0);
  const accommodationAmount = parsed.data.accommodationAmount ?? Number(before.accommodationAmount);
  const totalAmount = roundMoney(accommodationAmount + servicesTotal);
  const paidAmount = parsed.data.paidAmount;
  const data = {
    ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
    ...(parsed.data.salesChannelId === undefined ? {} : { salesChannelId: parsed.data.salesChannelId }),
    ...(parsed.data.managerComment === undefined ? {} : { managerComment: parsed.data.managerComment }),
    ...(parsed.data.cancellationReason === undefined ? {} : { cancellationReason: parsed.data.cancellationReason })
  };

  const after = await db.transaction(async (tx) => {
    if (resolved) {
      await tx.delete(bookingServices).where(eq(bookingServices.bookingId, id));
      if (resolved.lines.length) {
        await tx.insert(bookingServices).values(resolved.lines.map((line) => ({
          bookingId: id,
          serviceId: line.serviceId,
          serviceOptionId: line.serviceOptionId,
          serviceTitle: line.title,
          optionTitle: line.optionTitle,
          priceUnit: line.priceUnit,
          quantity: line.quantity,
          unitPrice: String(line.unitPrice),
          totalPrice: String(line.totalPrice)
        })));
      }
    }
    const [updated] = await tx.update(bookings).set({
      ...data,
      accommodationAmount: String(accommodationAmount),
      totalAmount: String(totalAmount),
      ...(paidAmount === undefined ? {} : { paidAmount: String(paidAmount) }),
      ...(parsed.data.status === "paid" ? { paymentStatus: "paid" } : {}),
      updatedAt: new Date()
    }).where(eq(bookings.id, id)).returning();
    if (parsed.data.status && parsed.data.status !== before.status) {
      await tx.insert(bookingStatusHistory).values({
        bookingId: id,
        fromStatus: before.status,
        toStatus: parsed.data.status,
        changedBy: authorized.auth.session.userId,
        comment: parsed.data.managerComment ?? undefined
      });
    }
    return updated;
  });

  const responseServices = (await getBookingServicesMap([id])).get(id) ?? [];
  await writeAudit({
    session: authorized.auth.session,
    request,
    action: "booking.update",
    entityType: "booking",
    entityId: id,
    before,
    after: { ...after, services: responseServices }
  });
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
  return Response.json({
    item: {
      ...after,
      accommodationAmount,
      servicesTotal,
      totalAmount,
      services: responseServices
    }
  });
}

export const PATCH = updateBooking;
export const PUT = updateBooking;
