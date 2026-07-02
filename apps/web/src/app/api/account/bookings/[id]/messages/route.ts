import { bookings, customerMessages, customers, db } from "@judilen/db";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { createAdminNotification } from "@/lib/admin-notifications";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

async function ownedBooking(id: string, userId: string) {
  const [row] = await db.select({ id: bookings.id }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(eq(bookings.id, id), eq(customers.userId, userId)))
    .limit(1);
  return row;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const { id } = await params;
  if (!(await ownedBooking(id, session.userId))) return problem(404, "Бронирование не найдено");
  const items = await db.select().from(customerMessages).where(and(
    eq(customerMessages.bookingId, id),
    eq(customerMessages.isInternal, false)
  )).orderBy(asc(customerMessages.createdAt));
  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const parsed = z.object({ message: z.string().trim().min(1).max(5000) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Сообщение пустое или слишком длинное");
  const { id } = await params;
  if (!(await ownedBooking(id, session.userId))) return problem(404, "Бронирование не найдено");
  const [item] = await db.insert(customerMessages).values({
    bookingId: id,
    authorUserId: session.userId,
    message: parsed.data.message,
    isInternal: false
  }).returning();
  await createAdminNotification({
    eventType: "customer_message",
    title: "Новое сообщение клиента",
    bookingId: id,
    href: "/admin/bookings",
    dedupeKey: `customer-message:${item.id}`
  });
  return Response.json({ item }, { status: 201 });
}
