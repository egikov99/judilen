import { db, expenseCategories } from "@judilen/db";
import { asc } from "drizzle-orm";
import { ReferenceDataManager } from "@/components/admin/reference-data-manager";
import { SettingsNavigation } from "@/components/admin/settings-navigation";
import { requirePagePermission } from "@/lib/session";

export default async function ExpenseCategoriesSettingsPage() {
  await requirePagePermission("expense_categories.manage");
  const rows = await db.select().from(expenseCategories).orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.name));
  return <main className="admin-content"><h1 className="admin-title">Статьи расходов</h1><p className="admin-subtitle">Категории финансового учета.</p><SettingsNavigation active="expenses" /><ReferenceDataManager initialRows={rows} endpoint="/api/admin/expense-categories" noun="статью" /></main>;
}
