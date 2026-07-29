import Link from "next/link";
import { notFound } from "next/navigation";
import { db, employees, expenseCategories, expenses, houses, users } from "@judilen/db";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { EmployeeDetailsEditor, type EmployeeUserOption } from "@/components/admin/employee-manager";
import { ExpenseManager } from "@/components/admin/expense-manager";
import { formatCurrency } from "@/components/currency";
import { employeeStatusLabels, type EmployeeRow } from "@/lib/employee-types";
import { requirePageAccess } from "@/lib/session";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function expenseRange(preset: string, from?: string, to?: string) {
  const now = new Date();
  if (preset === "previous_month") {
    return {
      from: isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))),
      to: isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)))
    };
  }
  if (preset === "year") return { from: `${now.getUTCFullYear()}-01-01`, to: `${now.getUTCFullYear()}-12-31` };
  if (preset === "custom" && from && to) return { from, to };
  return {
    from: isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    to: isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)))
  };
}

export default async function EmployeePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const access = await requirePageAccess("employees.read");
  const { id } = await params;
  const query = await searchParams;
  const preset = query.preset ?? "current_month";
  const range = expenseRange(preset, query.from, query.to);
  const selectedPeriod = and(eq(expenses.employeeId, id), gte(expenses.expenseDate, range.from), lte(expenses.expenseDate, range.to));
  const now = new Date();
  const currentMonthFrom = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const currentMonthTo = isoDate(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)));
  const [employeeRows, expenseRows, categories, houseRows, employeeOptions, userRows, selectedTotals, currentTotals, allTotals] = await Promise.all([
    db.select({
      id: employees.id, fullName: employees.fullName, position: employees.position, phone: employees.phone,
      email: employees.email, birthDate: employees.birthDate, startDate: employees.startDate, endDate: employees.endDate,
      status: employees.status, comment: employees.comment, personnelNumber: employees.personnelNumber, userId: employees.userId,
      userEmail: users.email, isActive: employees.isActive
    }).from(employees).leftJoin(users, eq(employees.userId, users.id)).where(eq(employees.id, id)).limit(1),
    db.select({
      id: expenses.id, expenseDate: expenses.expenseDate, amount: expenses.amount, categoryId: expenseCategories.id,
      categoryName: expenseCategories.name, categoryColor: expenseCategories.color, houseId: houses.id, houseName: houses.name,
      employeeId: employees.id, employeeName: employees.fullName, comment: expenses.comment, receiptFile: expenses.receiptFile,
      authorFirstName: users.firstName, authorLastName: users.lastName
    }).from(expenses).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id))
      .leftJoin(houses, eq(expenses.houseId, houses.id)).leftJoin(employees, eq(expenses.employeeId, employees.id))
      .leftJoin(users, eq(expenses.createdBy, users.id)).where(selectedPeriod)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)),
    db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.isActive, true)).orderBy(asc(expenseCategories.sortOrder)),
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select({ id: employees.id, fullName: employees.fullName, status: employees.status, isActive: employees.isActive }).from(employees).orderBy(asc(employees.fullName)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, linkedEmployeeId: employees.id }).from(users).leftJoin(employees, eq(employees.userId, users.id)).orderBy(asc(users.firstName)),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(selectedPeriod),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(and(eq(expenses.employeeId, id), gte(expenses.expenseDate, currentMonthFrom), lte(expenses.expenseDate, currentMonthTo))),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).where(eq(expenses.employeeId, id))
  ]);
  const employeeData = employeeRows[0];
  if (!employeeData) notFound();
  const employee: EmployeeRow = { ...employeeData, userEmail: employeeData.userEmail ?? null, expenseTotal: Number(allTotals[0]?.total ?? 0) };
  const mappedUsers: EmployeeUserOption[] = userRows.map((user) => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, linkedEmployeeId: user.linkedEmployeeId }));
  const canEditEmployee = access.permissions.includes("employees.write");
  const canWriteExpense = access.permissions.includes("expenses.write");
  return <main className="admin-content">
    <div className="breadcrumbs"><Link href="/admin/employees">Сотрудники</Link> / {employee.fullName}</div>
    <div className="section-heading compact-heading"><div><h1 className="admin-title">{employee.fullName}</h1><p className="admin-subtitle">{employee.position || "Должность не указана"}</p></div>{canEditEmployee && <EmployeeDetailsEditor employee={employee} users={mappedUsers} />}</div>
    <section className="panel"><div className="section-heading compact-heading"><div><span className="eyebrow">Общая информация</span><h2>Карточка сотрудника</h2></div><span className={`badge ${employee.status === "working" && employee.isActive ? "" : "badge-warn"}`}>{employeeStatusLabels[employee.status]}</span></div>
      <div className="report-grid"><div><div className="summary-row"><span>Телефон</span><strong>{employee.phone || "—"}</strong></div><div className="summary-row"><span>Email</span><strong>{employee.email || "—"}</strong></div><div className="summary-row"><span>Дата рождения</span><strong>{employee.birthDate || "—"}</strong></div></div><div><div className="summary-row"><span>Начало работы</span><strong>{employee.startDate || "—"}</strong></div><div className="summary-row"><span>Окончание работы</span><strong>{employee.endDate || "—"}</strong></div><div className="summary-row"><span>Табельный номер</span><strong>{employee.personnelNumber || "—"}</strong></div><div className="summary-row"><span>Пользователь</span><strong>{employee.userEmail || "Не связан"}</strong></div></div></div>
      {employee.comment && <div className="notice"><strong>Внутренний комментарий</strong><p>{employee.comment}</p></div>}
    </section>
    <section className="panel"><div className="section-heading compact-heading"><div><span className="eyebrow">Расходы</span><h2>История начислений</h2></div></div>
      <form className="report-filters"><div className="field"><label>Период</label><select name="preset" defaultValue={preset}><option value="current_month">Текущий месяц</option><option value="previous_month">Предыдущий месяц</option><option value="year">Текущий год</option><option value="custom">Произвольный</option></select></div><div className="field"><label>С</label><input name="from" type="date" defaultValue={range.from} /></div><div className="field"><label>По</label><input name="to" type="date" defaultValue={range.to} /></div><button className="button button-primary">Применить</button></form>
      <div className="stat-grid"><div className="stat-card"><div className="stat-label">Текущий месяц</div><div className="stat-value">{formatCurrency(Number(currentTotals[0]?.total ?? 0))}</div></div><div className="stat-card"><div className="stat-label">Выбранный период</div><div className="stat-value">{formatCurrency(Number(selectedTotals[0]?.total ?? 0))}</div></div><div className="stat-card"><div className="stat-label">За всё время</div><div className="stat-value">{formatCurrency(Number(allTotals[0]?.total ?? 0))}</div></div></div>
    </section>
    <ExpenseManager rows={expenseRows.map((row) => ({ ...row, houseId: row.houseId ?? null, houseName: row.houseName ?? null, employeeId: row.employeeId ?? null, employeeName: row.employeeName ?? null, authorName: `${row.authorFirstName ?? ""} ${row.authorLastName ?? ""}`.trim() || "Система" }))} categories={categories} houses={houseRows} employees={employeeOptions} canWrite={canWriteExpense} initialEmployeeId={id} lockEmployee createLabel="Начислить расход" exportQuery={new URLSearchParams({ employeeId: id, from: range.from, to: range.to }).toString()} />
  </main>;
}
