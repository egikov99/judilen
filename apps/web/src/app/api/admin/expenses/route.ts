import { db, expenseCategories, expenses, houses, users } from "@judilen/db";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { expenseSchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(request: Request) {
  const auth = await requirePermission("expenses.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const query = new URL(request.url).searchParams;
  const conditions = [
    query.get("from") ? gte(expenses.expenseDate, query.get("from")!) : undefined,
    query.get("to") ? lte(expenses.expenseDate, query.get("to")!) : undefined,
    query.get("houseId") ? eq(expenses.houseId, query.get("houseId")!) : undefined,
    query.get("categoryId") ? eq(expenses.expenseCategoryId, query.get("categoryId")!) : undefined,
    query.get("createdBy") ? eq(expenses.createdBy, query.get("createdBy")!) : undefined,
    query.get("search") ? or(ilike(expenses.comment, `%${query.get("search")}%`), ilike(expenseCategories.name, `%${query.get("search")}%`)) : undefined
  ];
  const items = await db.select({
    id: expenses.id,
    expenseDate: expenses.expenseDate,
    amount: expenses.amount,
    comment: expenses.comment,
    receiptFile: expenses.receiptFile,
    categoryId: expenseCategories.id,
    categoryName: expenseCategories.name,
    categoryColor: expenseCategories.color,
    houseId: houses.id,
    houseName: houses.name,
    createdBy: users.id,
    authorFirstName: users.firstName,
    authorLastName: users.lastName,
    createdAt: expenses.createdAt
  }).from(expenses)
    .innerJoin(expenseCategories, eq(expenses.expenseCategoryId, expenseCategories.id))
    .leftJoin(houses, eq(expenses.houseId, houses.id))
    .leftJoin(users, eq(expenses.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
    .limit(1000);
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requirePermission("expenses.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = expenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [category] = await db.select({ id: expenseCategories.id }).from(expenseCategories)
    .where(and(eq(expenseCategories.id, parsed.data.expenseCategoryId), eq(expenseCategories.isActive, true))).limit(1);
  if (!category) return problem(422, "Статья расхода недоступна");
  if (parsed.data.houseId) {
    const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, parsed.data.houseId)).limit(1);
    if (!house) return problem(422, "Домик не найден");
  }
  const [item] = await db.insert(expenses).values({
    expenseDate: parsed.data.expenseDate,
    amount: String(parsed.data.amount),
    expenseCategoryId: parsed.data.expenseCategoryId,
    houseId: parsed.data.type === "general" ? null : parsed.data.houseId,
    comment: parsed.data.comment,
    receiptFile: parsed.data.receiptFile,
    createdBy: auth.session.userId
  }).returning();
  await writeAudit({ session: auth.session, request, action: "expense.create", entityType: "expense", entityId: item.id, after: item });
  return Response.json({ item }, { status: 201 });
}
