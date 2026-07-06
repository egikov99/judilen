import { bookingDocuments, bookings, customers, db } from "@judilen/db";
import { and, asc, eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const { id } = await params;
  const [owned] = await db.select({ id: bookings.id }).from(bookings).innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(eq(bookings.id, id), eq(customers.userId, session.userId))).limit(1);
  if (!owned) return problem(404, "Бронирование не найдено");
  const items = await db.select({ id: bookingDocuments.id, title: bookingDocuments.title, mimeType: bookingDocuments.mimeType, createdAt: bookingDocuments.createdAt })
    .from(bookingDocuments).where(eq(bookingDocuments.bookingId, id)).orderBy(asc(bookingDocuments.createdAt));
  return Response.json({ items: items.map((item) => ({ ...item, url: `/api/account/documents/${item.id}` })) });
}
