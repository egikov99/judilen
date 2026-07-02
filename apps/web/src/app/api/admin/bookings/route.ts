import { bookingStatusHistory, bookings, customers, db, houses } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { createAdminNotification } from "@/lib/admin-notifications";
import { hasDatabaseErrorCode } from "@/lib/booking-availability";
import { findOverlappingBooking } from "@/lib/booking-availability-db";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const manualBookingSchema = z.object({
  houseId: z.uuid(),
  customerId: z.uuid().optional(),
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().max(80).default(""),
  email: z.email().max(254).optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  guests: z.coerce.number().int().min(1).max(30),
  totalAmount: z.coerce.number().nonnegative(),
  status: z.enum(["confirmed", "blocked"]).default("confirmed"),
  managerComment: z.string().trim().max(5000).optional()
}).refine((value) => value.checkOut > value.checkIn, { message: "Некорректный период" })
  .refine((value) => value.customerId || (value.firstName && value.email && value.phone), {
    message: "Укажите customerId либо данные нового клиента"
  });

function bookingNumber() {
  const date = new Date().toISOString().slice(2, 10).replaceAll("-", "");
  return `JD-${date}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
}

export async function GET() {
  const auth = await requirePermission("bookings.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const items = await db
    .select({
      id: bookings.id,
      publicNumber: bookings.publicNumber,
      status: bookings.status,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      guests: bookings.guests,
      totalAmount: bookings.totalAmount,
      paidAmount: bookings.paidAmount,
      customerName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      houseName: houses.name
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .orderBy(desc(bookings.createdAt))
    .limit(200);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requirePermission("bookings.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = manualBookingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [house] = await db.select({ guests: houses.guests }).from(houses).where(eq(houses.id, parsed.data.houseId)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  if (parsed.data.guests > house.guests) {
    return problem(422, "Количество гостей превышает вместимость домика");
  }
  if (await findOverlappingBooking(parsed.data.houseId, parsed.data.checkIn, parsed.data.checkOut)) {
    return problem(409, "Домик уже занят на выбранные даты", "Выберите другой домик или период");
  }
  const publicNumber = bookingNumber();
  try {
    const created = await db.transaction(async (tx) => {
      let customerId = parsed.data.customerId;
      if (!customerId) {
        const [customer] = await tx.insert(customers).values({
          firstName: parsed.data.firstName!,
          lastName: parsed.data.lastName,
          email: parsed.data.email!,
          phone: parsed.data.phone!
        }).onConflictDoUpdate({
          target: customers.email,
          set: {
            firstName: parsed.data.firstName!,
            lastName: parsed.data.lastName,
            phone: parsed.data.phone!,
            updatedAt: new Date()
          }
        }).returning({ id: customers.id });
        customerId = customer.id;
      }
      const [booking] = await tx.insert(bookings).values({
        publicNumber,
        houseId: parsed.data.houseId,
        customerId,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        guests: parsed.data.guests,
        totalAmount: String(parsed.data.totalAmount),
        status: parsed.data.status,
        source: "crm_manual",
        managerComment: parsed.data.managerComment
      }).returning();
      await tx.insert(bookingStatusHistory).values({
        bookingId: booking.id,
        toStatus: parsed.data.status,
        changedBy: auth.session.userId,
        comment: "Создано вручную"
      });
      return booking;
    });
    await writeAudit({ session: auth.session, request, action: "booking.create", entityType: "booking", entityId: created.id, after: created });
    await createAdminNotification({
      eventType: "booking_created",
      title: "Новое бронирование",
      bookingId: created.id,
      href: "/admin/bookings",
      dedupeKey: `booking-created:${created.id}`
    });
    return Response.json({ item: created }, { status: 201 });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23P01")) {
      return problem(409, "Домик уже занят на выбранные даты", "Выберите другой домик или период");
    }
    throw error;
  }
}
