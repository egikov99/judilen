import { db, employees, expenses, users } from "@judilen/db";
import { eq, sql } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { hasDatabaseErrorCode } from "@/lib/booking-availability";
import { employeeSchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("employees.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [item] = await db.select({
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
    .leftJoin(expenses, eq(expenses.employeeId, employees.id))
    .where(eq(employees.id, id))
    .groupBy(employees.id, users.id)
    .limit(1);
  if (!item) return problem(404, "Сотрудник не найден");
  return Response.json({ item });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("employees.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = employeeSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return problem(422, "Некорректные данные", parsed.success ? undefined : parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
  if (!before) return problem(404, "Сотрудник не найден");
  try {
    const [item] = await db.update(employees).set({ ...parsed.data, updatedAt: new Date() }).where(eq(employees.id, id)).returning();
    await writeAudit({ session: auth.session, request, action: "employee.update", entityType: "employee", entityId: id, before, after: item });
    return Response.json({ item });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) return problem(409, "Пользователь или табельный номер уже связан с другим сотрудником");
    throw error;
  }
}
