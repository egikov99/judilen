import { db, expenseCategories, expenses, houses, users } from "@judilen/db";
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { ExpenseManager } from "@/components/admin/expense-manager";
import { formatCurrency } from "@/components/currency";
import { requirePageAccess } from "@/lib/session";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requirePageAccess("expenses.read");
  const params = await searchParams;
  const conditions = [
    params.from ? gte(expenses.expenseDate, params.from) : undefined,
    params.to ? lte(expenses.expenseDate, params.to) : undefined,
    params.houseId ? eq(expenses.houseId, params.houseId) : undefined,
    params.categoryId ? eq(expenses.expenseCategoryId, params.categoryId) : undefined,
    params.createdBy ? eq(expenses.createdBy, params.createdBy) : undefined,
    params.search ? or(ilike(expenses.comment, `%${params.search}%`), ilike(expenseCategories.name, `%${params.search}%`)) : undefined
  ];
  const [rows, categories, houseRows, staff, categoryTotals, houseTotals, totalRows, monthlyTotals] = await Promise.all([
    db.select({
      id: expenses.id,
      expenseDate: expenses.expenseDate,
      amount: expenses.amount,
      categoryName: expenseCategories.name,
      categoryColor: expenseCategories.color,
      houseName: houses.name,
      comment: expenses.comment,
      receiptFile: expenses.receiptFile,
      authorFirstName: users.firstName,
      authorLastName: users.lastName
    }).from(expenses).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id)).leftJoin(houses, eq(expenses.houseId, houses.id)).leftJoin(users, eq(expenses.createdBy, users.id)).where(and(...conditions)).orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)).limit(1000),
    db.select({ id: expenseCategories.id, name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.isActive, true)).orderBy(asc(expenseCategories.sortOrder)),
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.isActive, true)).orderBy(users.firstName),
    db.select({ name: expenseCategories.name, color: expenseCategories.color, total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id)).where(and(...conditions)).groupBy(expenseCategories.id).orderBy(sql`sum(${expenses.amount}) desc`),
    db.select({ name: houses.name, total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).innerJoin(houses, eq(expenses.houseId, houses.id)).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id)).where(and(...conditions)).groupBy(houses.id).orderBy(sql`sum(${expenses.amount}) desc`),
    db.select({ total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id)).where(and(...conditions)),
    db.select({ month: sql<string>`to_char(date_trunc('month', ${expenses.expenseDate}), 'YYYY-MM')`, total: sql<string>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses).innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id)).where(and(...conditions)).groupBy(sql`date_trunc('month', ${expenses.expenseDate})`).orderBy(sql`date_trunc('month', ${expenses.expenseDate})`)
  ]);
  const total = Number(totalRows[0]?.total ?? 0);
  return <main className="admin-content"><h1 className="admin-title">Расходы</h1><p className="admin-subtitle">Финансовый учет по домикам, статьям и сотрудникам.</p>
    <form className="panel report-filters"><div className="field"><label>С</label><input name="from" type="date" defaultValue={params.from} /></div><div className="field"><label>По</label><input name="to" type="date" defaultValue={params.to} /></div><div className="field"><label>Домик</label><select name="houseId" defaultValue={params.houseId ?? ""}><option value="">Все</option>{houseRows.map((house) => <option value={house.id} key={house.id}>{house.name}</option>)}</select></div><div className="field"><label>Статья</label><select name="categoryId" defaultValue={params.categoryId ?? ""}><option value="">Все</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="field"><label>Сотрудник</label><select name="createdBy" defaultValue={params.createdBy ?? ""}><option value="">Все</option>{staff.map((user) => <option value={user.id} key={user.id}>{user.firstName} {user.lastName}</option>)}</select></div><div className="field"><label>Поиск</label><input name="search" defaultValue={params.search} /></div><button className="button button-primary">Применить</button></form>
    <div className="stat-grid"><div className="stat-card"><div className="stat-label">Общие расходы</div><div className="stat-value">{formatCurrency(total)}</div></div><div className="stat-card"><div className="stat-label">Операций</div><div className="stat-value">{rows.length}</div></div></div>
    <div className="report-grid"><section className="panel"><h2>По категориям</h2>{categoryTotals.map((item) => <div className="summary-row" key={item.name}><span><i className="color-dot" style={{ background: item.color }} />{item.name}</span><strong>{formatCurrency(Number(item.total))}</strong></div>)}</section><section className="panel"><h2>По домикам</h2>{houseTotals.map((item) => <div className="summary-row" key={item.name}><span>{item.name}</span><strong>{formatCurrency(Number(item.total))}</strong></div>)}</section><section className="panel"><h2>По месяцам</h2>{monthlyTotals.map((item) => <div className="summary-row" key={item.month}><span>{item.month}</span><strong>{formatCurrency(Number(item.total))}</strong></div>)}</section></div>
    <ExpenseManager rows={rows.map((row) => ({ ...row, houseName: row.houseName ?? null, authorName: `${row.authorFirstName ?? ""} ${row.authorLastName ?? ""}`.trim() || "Система" }))} categories={categories} houses={houseRows} canWrite={access.permissions.includes("expenses.write")} />
  </main>;
}
