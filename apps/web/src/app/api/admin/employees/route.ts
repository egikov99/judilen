import { db, employees, expenses, users } from "@judilen/db";
import { and, asc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { hasDatabaseErrorCode } from "@/lib/booking-availability";
import { employeeSchema } from "@/lib/crm-validation";
import { employeeStatuses, type EmployeeStatus } from "@/lib/employee-types";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requirePermission("employees.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const query = new URL(request.url).searchParams;
  const requestedStatus = query.get("status");
  const status = employeeStatuses.includes(requestedStatus as EmployeeStatus) ? requestedStatus as EmployeeStatus : undefined;
  const conditions = [
    status ? eq(employees.status, status) : undefined,
    query.get("position") ? eq(employees.position, query.get("position")!) : undefined,
    query.get("search") ? or(
      ilike(employees.fullName, `%${query.get("search")}%`),
      ilike(employees.phone, `%${query.get("search")}%`),
      ilike(employees.email, `%${query.get("search")}%`)
    ) : undefined
  ];
  const expenseJoin = and(
    eq(expenses.employeeId, employees.id),
    query.get("from") ? gte(expenses.expenseDate, query.get("from")!) : undefined,
    query.get("to") ? lte(expenses.expenseDate, query.get("to")!) : undefined
  );
  const items = await db.select({
    id: employees.id,
    fullName: employees.fullName,
    position: employees.position,
    phone: employees.phone,
    email: employees.email,
    birthDate: employees.birthDate,
    startDate: employees.startDate,
    endDate: employees.endDate,
    status: employees.status,
    comment: employees.comment,
    personnelNumber: employees.personnelNumber,
    userId: employees.userId,
    userEmail: users.email,
    isActive: employees.isActive,
    expenseTotal: sql<string>`coalesce(sum(${expenses.amount}), 0)`
  }).from(employees)
    .leftJoin(users, eq(employees.userId, users.id))
    .leftJoin(expenses, expenseJoin)
    .where(and(...conditions))
    .groupBy(employees.id, users.id)
    .orderBy(asc(employees.fullName));
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requirePermission("employees.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = employeeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  try {
    const [item] = await db.insert(employees).values(parsed.data).returning();
    await writeAudit({ session: auth.session, request, action: "employee.create", entityType: "employee", entityId: item.id, after: item });
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) return problem(409, "Пользователь или табельный номер уже связан с другим сотрудником");
    throw error;
  }
}
