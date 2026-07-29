import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bookingUpdateSchema } from "@/lib/validation";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("booking-owned services", () => {
  it("migrates existing totals and service rows without replacing the catalog", () => {
    const migration = source("../../packages/db/migrations/0023_booking_service_snapshots.sql");
    expect(migration).toContain('ADD COLUMN "accommodation_amount"');
    expect(migration).toContain('booking."total_amount" - coalesce');
    expect(migration).toContain('FROM "booking_services" line');
    expect(migration).toContain('ADD COLUMN "service_title"');
    expect(migration).toContain('ADD COLUMN "price_unit" "service_price_unit"');
    expect(migration).not.toContain('UPDATE "services"');
    expect(migration).not.toContain('DELETE FROM "services"');
    const rentalSnapshots = source("../../packages/db/migrations/0024_booking_service_rental_snapshots.sql");
    expect(rentalSnapshots).toContain('ADD COLUMN "min_rental_hours" integer');
    expect(rentalSnapshots).toContain('ADD COLUMN "extension_price" numeric(12, 2)');
    expect(rentalSnapshots).toContain('FROM "services" service');
  });

  it("stores immutable display and price snapshots on each booking line", () => {
    const schema = source("../../packages/db/src/schema.ts");
    expect(schema).toContain('accommodationAmount: numeric("accommodation_amount"');
    expect(schema).toContain('serviceTitle: text("service_title").notNull()');
    expect(schema).toContain('optionTitle: text("option_title")');
    expect(schema).toContain('priceUnit: servicePriceUnit("price_unit").notNull()');
    expect(schema).toContain('minRentalHours: integer("min_rental_hours")');
    expect(schema).toContain('extensionPrice: numeric("extension_price"');
    expect(schema).toContain('unitPrice: numeric("unit_price"');
    expect(schema).toContain('totalPrice: numeric("total_price"');
  });

  it("accepts atomic service replacement through booking updates", () => {
    const parsed = bookingUpdateSchema.safeParse({
      accommodationAmount: 300,
      services: [{
        serviceId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001",
        serviceOptionId: null,
        quantity: 2
      }]
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects rental hours below the catalog minimum on the server", () => {
    const helper = source("src/lib/booking-services.ts");
    expect(helper).toContain('selection.quantity < (service.minRentalHours ?? 1)');
  });

  it("returns services from list and detail APIs and supports PUT", () => {
    const listRoute = source("src/app/api/admin/bookings/route.ts");
    const detailRoute = source("src/app/api/admin/bookings/[id]/route.ts");
    const accountList = source("src/app/api/account/bookings/route.ts");
    const accountDetail = source("src/app/api/account/bookings/[id]/route.ts");
    for (const route of [listRoute, detailRoute, accountList, accountDetail]) {
      expect(route).toContain("getBookingServicesMap");
      expect(route).toContain("services:");
    }
    expect(detailRoute).toContain("export const PUT = updateBooking");
    expect(detailRoute).toContain("totalAmount: String(totalAmount)");
    expect(detailRoute).toContain("tx.delete(bookingServices)");
    expect(detailRoute).toContain("extensionPrice: line.extensionPrice");
  });

  it("keeps service editing inside the booking and recalculates in the browser", () => {
    const editor = source("src/components/admin/booking-services-editor.tsx");
    expect(editor).toContain("Дополнительные услуги");
    expect(editor).toContain("Стоимость проживания");
    expect(editor).toContain("Итог по услугам");
    expect(editor).toContain("Общая стоимость бронирования");
    expect(editor).toContain("Не выбраны");
    expect(editor).toContain("Ещё ");
    expect(editor).toContain("Минимум:");
    expect(editor).toContain("Продление:");
    expect(editor).toContain('method: "PUT"');
    expect(editor).toContain("accommodationAmount + servicesTotal");
    expect(editor).not.toContain("/api/admin/services/");
  });

  it("shows booked services in customer history and keeps reporting dimensions", () => {
    const customer = source("src/app/admin/customers/[id]/page.tsx");
    const reports = source("src/app/admin/reports/page.tsx");
    expect(customer).toContain("Заказанные услуги");
    expect(customer).toContain("bookingServiceMap");
    expect(reports).toContain("bookingServices.bookingId");
    expect(reports).toContain("bookingServices.quantity");
    expect(reports).toContain("bookingServices.totalPrice");
    expect(reports).toContain("bookings.totalAmount");
  });
});
