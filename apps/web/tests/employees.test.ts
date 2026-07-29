import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { employeeSchema, expenseSchema } from "@/lib/crm-validation";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("employees and expenses", () => {
  it("keeps employees separate from users and links each user at most once", () => {
    const schema = source("../../packages/db/src/schema.ts");
    expect(schema).toContain('export const employees = pgTable(');
    expect(schema).toContain('uniqueIndex("employees_user_unique")');
    expect(schema).toContain('employeeId: uuid("employee_id")');
    expect(schema).toContain('references(() => employees.id, { onDelete: "restrict" })');
  });

  it("migrates permissions and the optional expense relationship", () => {
    const migration = source("../../packages/db/migrations/0025_employees_expenses.sql");
    expect(migration).toContain('CREATE TABLE "employees"');
    expect(migration).toContain('ALTER TABLE "expenses" ADD COLUMN "employee_id" uuid');
    expect(migration).toContain("'employees.read'");
    expect(migration).toContain("'employees.write'");
  });

  it("validates employee records and employee-linked expenses", () => {
    expect(employeeSchema.safeParse({
      fullName: "Иван Иванов",
      position: "Администратор",
      phone: "+375291234567",
      email: "ivan@example.com",
      birthDate: null,
      startDate: "2026-01-10",
      endDate: null,
      status: "working",
      comment: null,
      personnelNumber: "EMP-001",
      userId: null,
      isActive: true
    }).success).toBe(true);
    expect(expenseSchema.safeParse({
      expenseDate: "2026-07-29",
      amount: 100,
      expenseCategoryId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1001",
      type: "general",
      employeeId: "7a5cc1f6-8b2e-42d2-b7c9-fb29f93f1002"
    }).success).toBe(true);
  });

  it("adds employee navigation, cards, expense filters and report grouping", () => {
    const auth = source("../../packages/auth/src/index.ts");
    const employeePage = source("src/app/admin/employees/page.tsx");
    const employeeManager = source("src/components/admin/employee-manager.tsx");
    const detailPage = source("src/app/admin/employees/[id]/page.tsx");
    const expensesPage = source("src/app/admin/expenses/page.tsx");
    const reportsPage = source("src/app/admin/reports/page.tsx");
    expect(auth).toContain('{ href: "/admin/employees", label: "Сотрудники"');
    expect(employeeManager).toContain("Добавить сотрудника");
    expect(employeePage).toContain("pageSize = 50");
    expect(detailPage).toContain('createLabel="Начислить расход"');
    expect(detailPage).toContain("Текущий месяц");
    expect(detailPage).toContain("За всё время");
    expect(expensesPage).toContain('<option value="none">Без сотрудника</option>');
    expect(reportsPage).toContain("Расходы по сотрудникам и статьям");
    expect(reportsPage).toContain("employeeCategoryMap");
  });
});
