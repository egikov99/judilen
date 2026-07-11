import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { expenseSchema, salesChannelSchema } from "@/lib/crm-validation";
import { csvExport, excelHtmlExport, simplePdfExport } from "@/lib/tabular-export";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("CRM sales, finance, and customer privacy", () => {
  it("creates backward-compatible indexed CRM tables", () => {
    const migration = source("../../packages/db/migrations/0020_crm_finance_sales.sql");
    expect(migration).toContain('CREATE TABLE "sales_channels"');
    expect(migration).toContain('ADD COLUMN "sales_channel_id" uuid');
    expect(migration).not.toContain('"sales_channel_id" uuid NOT NULL');
    expect(migration).toContain('CREATE TABLE "expense_categories"');
    expect(migration).toContain('CREATE TABLE "expenses"');
    expect(migration).toContain('CREATE TABLE "client_notes"');
    expect(migration).toContain('CREATE TABLE "client_note_revisions"');
    for (const index of ["bookings_sales_channel_idx", "bookings_house_idx", "bookings_check_in_idx", "bookings_payment_status_idx", "expenses_date_idx", "expenses_house_idx", "expenses_category_idx", "client_notes_client_idx"]) {
      expect(migration).toContain(index);
    }
  });

  it("validates channels and requires a house for house expenses", () => {
    expect(salesChannelSchema.safeParse({ name: "Телефон", slug: "phone", color: "#315f86", icon: "phone", isActive: true, sortOrder: 10 }).success).toBe(true);
    expect(expenseSchema.safeParse({ expenseDate: "2026-07-06", amount: 100, expenseCategoryId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", type: "general" }).success).toBe(true);
    expect(expenseSchema.safeParse({ expenseDate: "2026-07-06", amount: 100, expenseCategoryId: "8fc5f68a-330f-4f50-b6e4-dcb260b12301", type: "house" }).success).toBe(false);
  });

  it("keeps sales channels and CRM notes out of customer APIs", () => {
    const accountBookings = source("src/app/api/account/bookings/route.ts");
    const authMe = source("src/app/api/auth/me/route.ts");
    const publicBooking = source("src/app/api/bookings/route.ts");
    expect(accountBookings).not.toContain("clientNotes");
    expect(accountBookings).not.toContain("salesChannel");
    expect(authMe).not.toContain("clientNotes");
    expect(authMe).not.toContain("salesChannel");
    expect(publicBooking).not.toContain("salesChannelName");
  });

  it("checks dedicated permissions on financial and note APIs", () => {
    expect(source("src/app/api/admin/expenses/route.ts")).toContain('requirePermission("expenses.read")');
    expect(source("src/app/api/admin/expenses/route.ts")).toContain('requirePermission("expenses.write")');
    expect(source("src/app/api/admin/expense-receipts/[filename]/route.ts")).toContain('requirePermission("expenses.read")');
    expect(source("src/app/api/admin/expenses/receipts/route.ts")).not.toContain("/uploads/");
    expect(source("src/app/api/admin/customers/[id]/notes/route.ts")).toContain('requirePermission("client_notes.read")');
    expect(source("src/app/api/admin/client-notes/[id]/route.ts")).toContain('requirePermission("client_notes.write")');
    expect(source("src/app/api/admin/exports/[entity]/route.ts")).toContain('"exports.read"');
    const clientDocument = source("src/app/api/account/documents/[id]/route.ts");
    expect(clientDocument).toContain("customers.userId");
    expect(clientDocument).toContain("session.userId");
  });

  it("exports valid CSV, Excel-compatible HTML, and PDF", () => {
    const rows = [{ name: "Дом", amount: 350 }];
    expect(csvExport(rows)).toContain('"Дом";"350"');
    expect(excelHtmlExport(rows, "Отчет")).toContain("charset=\"utf-8\"");
    expect(excelHtmlExport(rows, "Отчет")).toContain("<table");
    expect(simplePdfExport(rows, "Report").subarray(0, 8).toString()).toBe("%PDF-1.4");
  });

  it("calculates report revenue only from paid non-cancelled bookings", () => {
    const reports = source("src/app/admin/reports/page.tsx");
    expect(reports).toContain('eq(bookings.paymentStatus, "paid")');
    expect(reports).toContain("excludedPaidMetricStatuses");
    expect(reports).toContain("Прибыль");
    expect(reports).toContain("Продажи по каналам");
  });

  it("keeps expense and report filters responsive on narrow admin screens", () => {
    const styles = source("src/app/globals.css");
    expect(source("src/app/admin/expenses/page.tsx")).toContain('className="panel report-filters"');
    expect(source("src/app/admin/reports/page.tsx")).toContain('className="panel report-filters"');
    expect(styles).toContain(".report-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(styles).toContain(".report-filters > *, .report-filters .field { min-width: 0; }");
    expect(styles).toContain('.report-filters .field input, .report-filters .field select, .report-filters .field textarea, .report-filters input[type="date"]');
    expect(styles).toContain("width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box;");
    expect(styles).toContain(".report-filters select { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }");
    expect(styles).toContain("@media (max-width: 650px)");
    expect(styles).toContain(".report-filters { grid-template-columns: 1fr; }");
    expect(styles).toContain(".report-filters > *, .report-filters .button { width: 100%; }");
  });
});
