import { db, employees, expenses, users } from "@judilen/db";
import { and, asc, count, desc, eq, gte, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { EmployeeManager, type EmployeeUserOption } from "@/components/admin/employee-manager";
import { employeeStatusLabels, employeeStatuses, type EmployeeRow, type EmployeeStatus } from "@/lib/employee-types";
import { requirePageAccess } from "@/lib/session";

const pageSize = 50;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requirePageAccess("employees.read");
  const params = await searchParams;
  const now = new Date();
  const defaultFrom = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;
  const status = employeeStatuses.includes(params.status as EmployeeStatus) ? params.status as EmployeeStatus : undefined;
  const page = Math.max(1, Number(params.page) || 1);
  const conditions = [
    status ? eq(employees.status, status) : undefined,
    params.position ? eq(employees.position, params.position) : undefined,
    params.search ? or(ilike(employees.fullName, `%${params.search}%`), ilike(employees.phone, `%${params.search}%`), ilike(employees.email, `%${params.search}%`)) : undefined
  ];
  const expenseJoin = and(eq(expenses.employeeId, employees.id), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to));
  const expenseTotal = sql<string>`coalesce(sum(${expenses.amount}), 0)`;
  const sortColumns = {
    name: employees.fullName,
    position: employees.position,
    status: employees.status,
    startDate: employees.startDate,
    expenses: expenseTotal
  };
  const sort = params.sort && params.sort in sortColumns ? params.sort as keyof typeof sortColumns : "name";
  const direction = params.direction === "desc" ? "desc" : "asc";
  const [rows, totalRows, positions, userRows] = await Promise.all([
    db.select({
      id: employees.id, fullName: employees.fullName, position: employees.position, phone: employees.phone,
      email: employees.email, birthDate: employees.birthDate, startDate: employees.startDate, endDate: employees.endDate,
      status: employees.status, comment: employees.comment, personnelNumber: employees.personnelNumber, userId: employees.userId,
      userEmail: users.email, isActive: employees.isActive, expenseTotal
    }).from(employees).leftJoin(users, eq(employees.userId, users.id)).leftJoin(expenses, expenseJoin)
      .where(and(...conditions)).groupBy(employees.id, users.id)
      .orderBy(direction === "desc" ? desc(sortColumns[sort]) : asc(sortColumns[sort]))
      .limit(pageSize).offset((page - 1) * pageSize),
    db.select({ value: count() }).from(employees).where(and(...conditions)),
    db.selectDistinct({ position: employees.position }).from(employees).where(isNotNull(employees.position)).orderBy(asc(employees.position)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email, linkedEmployeeId: employees.id })
      .from(users).leftJoin(employees, eq(employees.userId, users.id)).orderBy(asc(users.firstName), asc(users.lastName))
  ]);
  const total = totalRows[0]?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const queryForPage = (target: number) => {
    const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
    query.set("page", String(target));
    return `/admin/employees?${query}`;
  };
  const mappedUsers: EmployeeUserOption[] = userRows.map((user) => ({ id: user.id, name: `${user.firstName} ${user.lastName}`.trim(), email: user.email, linkedEmployeeId: user.linkedEmployeeId }));
  return <main className="admin-content"><h1 className="admin-title">Сотрудники</h1><p className="admin-subtitle">Люди, выплаты и другие расходы. Учетные записи находятся в отдельном разделе «Пользователи».</p>
    <form className="panel report-filters"><div className="field"><label>Поиск</label><input name="search" defaultValue={params.search} placeholder="ФИО, телефон или email" /></div><div className="field"><label>Статус</label><select name="status" defaultValue={status ?? ""}><option value="">Все</option>{employeeStatuses.map((item) => <option key={item} value={item}>{employeeStatusLabels[item]}</option>)}</select></div><div className="field"><label>Должность</label><select name="position" defaultValue={params.position ?? ""}><option value="">Все</option>{positions.map((item) => <option key={item.position} value={item.position!}>{item.position}</option>)}</select></div><div className="field"><label>Расходы с</label><input name="from" type="date" defaultValue={from} /></div><div className="field"><label>Расходы по</label><input name="to" type="date" defaultValue={to} /></div><div className="field"><label>Сортировка</label><select name="sort" defaultValue={sort}><option value="name">ФИО</option><option value="position">Должность</option><option value="status">Статус</option><option value="startDate">Дата начала</option><option value="expenses">Сумма расходов</option></select></div><div className="field"><label>Направление</label><select name="direction" defaultValue={direction}><option value="asc">По возрастанию</option><option value="desc">По убыванию</option></select></div><button className="button button-primary">Применить</button></form>
    <EmployeeManager rows={rows.map((row) => ({ ...row, userEmail: row.userEmail ?? null, expenseTotal: Number(row.expenseTotal) })) as EmployeeRow[]} users={mappedUsers} canWrite={access.permissions.includes("employees.write")} />
    {pageCount > 1 && <nav className="button-row" aria-label="Пагинация">{page > 1 && <a className="button button-ghost" href={queryForPage(page - 1)}>Назад</a>}<span className="notice">Страница {page} из {pageCount}</span>{page < pageCount && <a className="button button-ghost" href={queryForPage(page + 1)}>Далее</a>}</nav>}
  </main>;
}
