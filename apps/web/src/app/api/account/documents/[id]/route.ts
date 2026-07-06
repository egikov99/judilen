import { bookingDocuments, bookings, customers, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { readBookingDocument } from "@/lib/booking-documents";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const { id } = await params;
  const [document] = await db.select({
    fileName: bookingDocuments.fileName,
    mimeType: bookingDocuments.mimeType
  }).from(bookingDocuments)
    .innerJoin(bookings, eq(bookingDocuments.bookingId, bookings.id))
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .where(and(eq(bookingDocuments.id, id), eq(customers.userId, session.userId))).limit(1);
  if (!document) return problem(404, "Документ не найден");
  const bytes = await readBookingDocument(document.fileName);
  if (!bytes) return problem(404, "Файл документа не найден");
  return new Response(bytes, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `inline; filename="${document.fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
