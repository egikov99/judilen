import { bookings, customers, db, houses, roles, users } from "@judilen/db";
import { and, eq, ne } from "drizzle-orm";
import { formatCurrency } from "@/lib/catalog";
import { sendTemplatedEmail } from "./email";
import type { EmailTemplateKey } from "./email-templates";

const statusLabels: Record<string, string> = {
  awaiting_confirmation: "ожидает подтверждения",
  confirmed: "подтверждено",
  cancelled: "отменено",
  completed: "завершено"
};

export async function getBookingEmailContext(bookingId: string) {
  const [row] = await db.select({
    id: bookings.id,
    publicNumber: bookings.publicNumber,
    checkIn: bookings.checkIn,
    checkOut: bookings.checkOut,
    totalAmount: bookings.totalAmount,
    status: bookings.status,
    customerName: customers.firstName,
    customerEmail: customers.email,
    houseName: houses.name
  }).from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(houses, eq(bookings.houseId, houses.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return null;
  const baseUrl = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    row,
    variables: {
      customerName: row.customerName,
      bookingNumber: row.publicNumber,
      houseName: row.houseName,
      checkInDate: row.checkIn,
      checkOutDate: row.checkOut,
      totalPrice: formatCurrency(Number(row.totalAmount)),
      bookingStatus: statusLabels[row.status] ?? row.status,
      reviewUrl: `${baseUrl}/otzyvy/novyi?booking=${encodeURIComponent(row.publicNumber)}`
    }
  };
}

export async function sendBookingCustomerEmail(bookingId: string, templateKey: EmailTemplateKey, eventKey: string) {
  const context = await getBookingEmailContext(bookingId);
  if (!context) return;
  return sendTemplatedEmail({
    to: context.row.customerEmail,
    templateKey,
    variables: context.variables,
    bookingId,
    dedupeKey: `${eventKey}:customer:${bookingId}`
  });
}

export async function sendNewBookingEmails(bookingId: string) {
  const context = await getBookingEmailContext(bookingId);
  if (!context) return;
  await sendTemplatedEmail({
    to: context.row.customerEmail,
    templateKey: "booking_received",
    variables: context.variables,
    bookingId,
    dedupeKey: `booking-created:customer:${bookingId}`
  });
  const admins = await db.select({ email: users.email }).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.isActive, true), ne(roles.name, "client")));
  await Promise.all(admins.map((admin) => sendTemplatedEmail({
    to: admin.email,
    templateKey: "admin_new_booking",
    variables: context.variables,
    bookingId,
    dedupeKey: `booking-created:admin:${bookingId}:${admin.email}`
  })));
}
