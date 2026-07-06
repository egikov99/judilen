import { bookingDocuments, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { readBookingDocument, removeBookingDocument } from "@/lib/booking-documents";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("bookings.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [document] = await db.select().from(bookingDocuments).where(eq(bookingDocuments.id, id)).limit(1);
  if (!document) return problem(404, "Документ не найден");
  const bytes = await readBookingDocument(document.fileName);
  if (!bytes) return problem(404, "Файл документа не найден");
  return new Response(bytes, { headers: { "Content-Type": document.mimeType, "Content-Disposition": `inline; filename="${document.fileName}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("bookings.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [document] = await db.delete(bookingDocuments).where(eq(bookingDocuments.id, id)).returning();
  if (!document) return problem(404, "Документ не найден");
  await removeBookingDocument(document.fileName);
  await writeAudit({ session: auth.session, request, action: "booking_document.delete", entityType: "booking_document", entityId: id, before: { id, bookingId: document.bookingId, title: document.title } });
  return Response.json({ item: { id } });
}
