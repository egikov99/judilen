import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculatePaidBookingMetrics } from "@/lib/paid-booking-metrics";

describe("paid booking metrics", () => {
  it("excludes a cancelled 20,000 Br booking from revenue and average check", () => {
    const metrics = calculatePaidBookingMetrics([
      { status: "paid", paymentStatus: "paid", totalAmount: "10000", paidAmount: "10000" },
      { status: "cancelled", paymentStatus: "paid", totalAmount: "20000", paidAmount: "20000" }
    ]);
    expect(metrics).toEqual({ revenue: 10000, averageCheck: 10000, paidBookingCount: 1 });
  });

  it("excludes unpaid, pending, zero-value, and refunded bookings", () => {
    const metrics = calculatePaidBookingMetrics([
      { status: "new", paymentStatus: "unpaid", totalAmount: "5000", paidAmount: "0" },
      { status: "awaiting_payment", paymentStatus: "pending", totalAmount: "6000", paidAmount: "0" },
      { status: "paid", paymentStatus: "paid", totalAmount: "0", paidAmount: "0" },
      { status: "completed", paymentStatus: "refunded", totalAmount: "7000", paidAmount: "7000" }
    ]);
    expect(metrics).toEqual({ revenue: 0, averageCheck: 0, paidBookingCount: 0 });
  });

  it("uses the payment-status filter in the reports SQL queries", () => {
    const reports = readFileSync(resolve(process.cwd(), "src/app/admin/reports/page.tsx"), "utf8");
    expect(reports).toContain('eq(bookings.paymentStatus, "paid")');
    expect(reports).toContain(".where(paidBookingFilter)");
    expect(reports).not.toContain("avg(${bookings.totalAmount}), 0)` }).from(bookings),");
  });
});
