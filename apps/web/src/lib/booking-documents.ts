import { mkdir, readFile, unlink } from "node:fs/promises";

export function bookingDocumentRoot() {
  return process.env.BOOKING_DOCUMENT_DIR ?? "/app/storage/booking-documents";
}

export async function ensureBookingDocumentRoot() {
  const root = bookingDocumentRoot();
  await mkdir(root, { recursive: true });
  return root;
}

export function safeBookingDocumentName(value: string) {
  return /^[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(value) ? value : null;
}

export async function readBookingDocument(fileName: string) {
  const safeName = safeBookingDocumentName(fileName);
  if (!safeName) return null;
  return readFile(`${bookingDocumentRoot()}/${safeName}`).catch(() => null);
}

export async function removeBookingDocument(fileName: string) {
  const safeName = safeBookingDocumentName(fileName);
  if (!safeName) return;
  await unlink(`${bookingDocumentRoot()}/${safeName}`).catch(() => undefined);
}
