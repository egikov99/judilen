import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculateCustomerPaidSummary } from "@/lib/customer-paid-summary";

describe("customer paid summary", () => {
  it("shows actual paid amounts even when a legacy payment status is stale", () => {
    expect(calculateCustomerPaidSummary([
      { status: "paid", paymentStatus: "unpaid", paidAmount: "150" },
      { status: "completed", paymentStatus: "paid", paidAmount: "350" }
    ])).toEqual({ total: 500, count: 2, average: 250 });
  });

  it("does not count cancelled, blocked or refunded payments", () => {
    expect(calculateCustomerPaidSummary([
      { status: "cancelled", paymentStatus: "paid", paidAmount: "100" },
      { status: "blocked", paymentStatus: "paid", paidAmount: "200" },
      { status: "completed", paymentStatus: "refunded", paidAmount: "300" }
    ])).toEqual({ total: 0, count: 0, average: 0 });
  });

  it("fills paidAmount when an administrator marks a booking as paid", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/admin/bookings/[id]/route.ts"), "utf8");
    const customerPage = readFileSync(resolve(process.cwd(), "src/app/admin/customers/[id]/page.tsx"), "utf8");
    expect(route).toContain('parsed.data.status === "paid" ? totalAmount');
    expect(route).toContain("paidAmount: String(effectivePaidAmount)");
    expect(customerPage).toContain("calculateCustomerPaidSummary(bookingRows)");
  });
});
