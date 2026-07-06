import { db, expenseCategories } from "@judilen/db";
import { asc } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { expenseCategorySchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("expense_categories.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json({ items: await db.select().from(expenseCategories).orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name)) });
}

export async function POST(request: Request) {
  const auth = await requirePermission("expense_categories.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = expenseCategorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [item] = await db.insert(expenseCategories).values(parsed.data).returning();
  await writeAudit({ session: auth.session, request, action: "expense_category.create", entityType: "expense_category", entityId: item.id, after: item });
  return Response.json({ item }, { status: 201 });
}
