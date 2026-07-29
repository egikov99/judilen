import { db, employees, expenseCategories, expenses, houses } from "@judilen/db";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { expenseSchema } from "@/lib/crm-validation";
import { removeExpenseReceipt } from "@/lib/expense-receipts";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("expenses.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = expenseSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return problem(422, "Некорректные данные", parsed.success ? undefined : parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!before) return problem(404, "Расход не найден");
  if (parsed.data.employeeId) {
    const [employee] = await db.select({ id: employees.id }).from(employees).where(eq(employees.id, parsed.data.employeeId)).limit(1);
    if (!employee) return problem(422, "Сотрудник не найден");
  }
  if (parsed.data.houseId) {
    const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, parsed.data.houseId)).limit(1);
    if (!house) return problem(422, "Домик не найден");
  }
  if (parsed.data.expenseCategoryId) {
    const [category] = await db.select({ id: expenseCategories.id }).from(expenseCategories).where(eq(expenseCategories.id, parsed.data.expenseCategoryId)).limit(1);
    if (!category) return problem(422, "Статья расхода не найдена");
  }
  const { type, amount, ...data } = parsed.data;
  const [item] = await db.update(expenses).set({
    ...data,
    ...(amount === undefined ? {} : { amount: String(amount) }),
    ...(type === "general" ? { houseId: null } : {}),
    updatedAt: new Date()
  }).where(eq(expenses.id, id)).returning();
  if (data.receiptFile !== undefined && before.receiptFile && before.receiptFile !== data.receiptFile) {
    await removeExpenseReceipt(before.receiptFile);
  }
  await writeAudit({ session: auth.session, request, action: "expense.update", entityType: "expense", entityId: id, before, after: item });
  return Response.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("expenses.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [item] = await db.delete(expenses).where(eq(expenses.id, id)).returning();
  if (!item) return problem(404, "Расход не найден");
  if (item.receiptFile) await removeExpenseReceipt(item.receiptFile);
  await writeAudit({ session: auth.session, request, action: "expense.delete", entityType: "expense", entityId: id, before: item });
  return Response.json({ item });
}
