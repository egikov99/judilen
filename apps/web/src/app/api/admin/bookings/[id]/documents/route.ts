import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { bookingDocuments, bookings, db } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { ensureBookingDocumentRoot } from "@/lib/booking-documents";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { requirePermission } from "@/lib/session";
import { stripImageMetadata } from "@/lib/uploads";
import { problem } from "@/lib/validation";

export const runtime = "nodejs";

function documentType(bytes: Uint8Array) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return { ext: "pdf", mime: "application/pdf", imageType: null };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: "jpg", mime: "image/jpeg", imageType: "jpg" as const };
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return { ext: "png", mime: "image/png", imageType: "png" as const };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { ext: "webp", mime: "image/webp", imageType: "webp" as const };
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("bookings.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const items = await db.select({ id: bookingDocuments.id, title: bookingDocuments.title, mimeType: bookingDocuments.mimeType, createdAt: bookingDocuments.createdAt })
    .from(bookingDocuments).where(eq(bookingDocuments.bookingId, id)).orderBy(asc(bookingDocuments.createdAt));
  return Response.json({ items });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("bookings.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, { scope: "booking.document", limit: 20, windowMs: 60_000, identifier: auth.session.userId });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const { id } = await params;
  const [booking] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return problem(404, "Бронирование не найдено");
  const maxBytes = 10_485_760;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes + 65_536) return problem(413, "Размер файла не должен превышать 10 MB");
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "").trim();
  if (!(file instanceof File) || !title || title.length > 200) return problem(422, "Укажите название и файл документа");
  if (file.size <= 0 || file.size > maxBytes) return problem(413, "Размер файла не должен превышать 10 MB");
  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer());
  const type = documentType(bytes);
  if (!type) return problem(415, "Разрешены PDF, JPEG, PNG и WEBP");
  if (type.imageType) bytes = await stripImageMetadata(bytes, type.imageType);
  const fileName = `${randomUUID()}.${type.ext}`;
  const root = await ensureBookingDocumentRoot();
  await writeFile(`${root}/${fileName}`, bytes, { flag: "wx", mode: 0o640 });
  const [item] = await db.insert(bookingDocuments).values({ bookingId: id, title, fileName, mimeType: type.mime, createdBy: auth.session.userId }).returning();
  await writeAudit({ session: auth.session, request, action: "booking_document.create", entityType: "booking_document", entityId: item.id, after: { id: item.id, bookingId: id, title, mimeType: type.mime } });
  return Response.json({ item: { id: item.id, title: item.title, mimeType: item.mimeType, createdAt: item.createdAt } }, { status: 201 });
}
