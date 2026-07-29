import { bookingServices, db, serviceOptions, services } from "@judilen/db";
import { asc, eq, inArray } from "drizzle-orm";
import { getActiveServicesByIds } from "./services";
import { roundMoney } from "./weekday-prices";

export type BookingServiceSelection = {
  serviceId: string;
  serviceOptionId?: string | null;
  quantity: number;
};

export type BookingServiceItem = {
  id: string;
  bookingId: string;
  serviceId: string;
  serviceOptionId: string | null;
  title: string;
  optionTitle: string | null;
  priceUnit: "hour" | "day" | "booking" | "person" | "item";
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type NewBookingServiceLine = Omit<BookingServiceItem, "id" | "bookingId">;

export async function resolveBookingServiceLines(
  selections: BookingServiceSelection[],
  houseId: string,
  existingLines: BookingServiceItem[] = []
): Promise<{ lines: NewBookingServiceLine[]; invalid: boolean }> {
  if (!selections.length) return { lines: [], invalid: false };
  const activeServices = await getActiveServicesByIds(
    [...new Set(selections.map((item) => item.serviceId))],
    houseId
  );
  let invalid = false;
  const seen = new Set<string>();
  const lines: NewBookingServiceLine[] = [];

  for (const selection of selections) {
    const service = activeServices.find((item) => item.id === selection.serviceId);
    const existing = existingLines.find((item) => (
      item.serviceId === selection.serviceId &&
      item.serviceOptionId === (selection.serviceOptionId ?? null)
    ));
    if (!service && existing && Number.isInteger(selection.quantity) && selection.quantity >= 1) {
      const identity = `${existing.serviceId}:${existing.serviceOptionId ?? "base"}`;
      if (seen.has(identity)) {
        invalid = true;
        continue;
      }
      seen.add(identity);
      lines.push({
        serviceId: existing.serviceId,
        serviceOptionId: existing.serviceOptionId,
        title: existing.title,
        optionTitle: existing.optionTitle,
        priceUnit: existing.priceUnit,
        quantity: selection.quantity,
        unitPrice: existing.unitPrice,
        totalPrice: roundMoney(existing.unitPrice * selection.quantity)
      });
      continue;
    }
    if (
      !service ||
      !Number.isInteger(selection.quantity) ||
      selection.quantity < 1 ||
      (service.priceUnit === "hour" && selection.quantity < (service.minRentalHours ?? 1))
    ) {
      invalid = true;
      continue;
    }
    const option = selection.serviceOptionId
      ? service.options.find((item) => item.id === selection.serviceOptionId)
      : service.options.find((item) => item.isDefault) ?? service.options[0];
    if (selection.serviceOptionId && !option) {
      invalid = true;
      continue;
    }
    const identity = `${service.id}:${option?.id ?? "base"}`;
    if (seen.has(identity)) {
      invalid = true;
      continue;
    }
    seen.add(identity);
    const unitPrice = option?.price ?? service.basePrice;
    lines.push({
      serviceId: service.id,
      serviceOptionId: option?.id ?? null,
      title: service.title,
      optionTitle: option?.title ?? null,
      priceUnit: service.priceUnit as NewBookingServiceLine["priceUnit"],
      quantity: selection.quantity,
      unitPrice,
      totalPrice: roundMoney(unitPrice * selection.quantity)
    });
  }
  return { lines, invalid };
}

export async function getBookingServicesMap(bookingIds: string[]) {
  const grouped = new Map<string, BookingServiceItem[]>();
  if (!bookingIds.length) return grouped;
  const rows = await db.select({
    id: bookingServices.id,
    bookingId: bookingServices.bookingId,
    serviceId: bookingServices.serviceId,
    serviceOptionId: bookingServices.serviceOptionId,
    snapshotTitle: bookingServices.serviceTitle,
    catalogTitle: services.title,
    snapshotOptionTitle: bookingServices.optionTitle,
    catalogOptionTitle: serviceOptions.title,
    priceUnit: bookingServices.priceUnit,
    quantity: bookingServices.quantity,
    unitPrice: bookingServices.unitPrice,
    totalPrice: bookingServices.totalPrice
  }).from(bookingServices)
    .innerJoin(services, eq(bookingServices.serviceId, services.id))
    .leftJoin(serviceOptions, eq(bookingServices.serviceOptionId, serviceOptions.id))
    .where(inArray(bookingServices.bookingId, bookingIds))
    .orderBy(asc(bookingServices.createdAt));

  for (const row of rows) {
    const item: BookingServiceItem = {
      id: row.id,
      bookingId: row.bookingId,
      serviceId: row.serviceId,
      serviceOptionId: row.serviceOptionId,
      title: row.snapshotTitle || row.catalogTitle,
      optionTitle: row.snapshotOptionTitle || row.catalogOptionTitle,
      priceUnit: row.priceUnit,
      quantity: row.quantity,
      unitPrice: Number(row.unitPrice),
      totalPrice: Number(row.totalPrice)
    };
    grouped.set(row.bookingId, [...(grouped.get(row.bookingId) ?? []), item]);
  }
  return grouped;
}

export function bookingServicesTotal(lines: Array<Pick<BookingServiceItem, "totalPrice">>) {
  return roundMoney(lines.reduce((sum, line) => sum + Number(line.totalPrice), 0));
}

export function bookingServiceQuantityLabel(priceUnit: BookingServiceItem["priceUnit"], quantity: number) {
  if (priceUnit === "hour") return `${quantity} ч.`;
  if (priceUnit === "day") return `${quantity} дн.`;
  if (priceUnit === "person") return `${quantity} чел.`;
  return String(quantity);
}
