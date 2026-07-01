export const blockingBookingStatuses = [
  "pending",
  "awaiting_confirmation",
  "confirmed",
  "awaiting_payment",
  "paid",
  "external",
  "blocked"
] as const;

export function dateRangesOverlap(searchStart: string, searchEnd: string, bookingStart: string, bookingEnd: string) {
  return searchStart < bookingEnd && searchEnd > bookingStart;
}

export function hasDatabaseErrorCode(error: unknown, expectedCode: string) {
  let current = error;
  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth++) {
    if ("code" in current && String(current.code) === expectedCode) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}
