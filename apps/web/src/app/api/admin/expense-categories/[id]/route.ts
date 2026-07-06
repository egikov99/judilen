import { db, expenseCategories, expenses } from "@judilen/db";
import { count, eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { expenseCategorySchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("expense_categories.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = expenseCategorySchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return problem(422, "Некорректные данные", parsed.success ? undefined : parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id)).limit(1);
  if (!before) return problem(404, "Статья не найдена");
  const [item] = await db.update(expenseCategories).set({ ...parsed.data, updatedAt: new Date() }).where(eq(expenseCategories.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "expense_category.update", entityType: "expense_category", entityId: id, before, after: item });
  return Response.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("expense_categories.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [usage] = await db.select({ value: count() }).from(expenses).where(eq(expenses.expenseCategoryId, id));
  if ((usage?.value ?? 0) > 0) return problem(409, "Статья уже использовалась", "Её можно только архивировать");
  const [item] = await db.delete(expenseCategories).where(eq(expenseCategories.id, id)).returning();
  if (!item) return problem(404, "Статья не найдена");
  await writeAudit({ session: auth.session, request, action: "expense_category.delete", entityType: "expense_category", entityId: id, before: item });
  return Response.json({ item });
}
