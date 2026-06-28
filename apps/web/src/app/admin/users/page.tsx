import { db, roles, users } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { UserCreateForm } from "@/components/admin/user-create-form";
import { requirePagePermission } from "@/lib/session";

export default async function UsersPage() {
  await requirePagePermission("users.manage");
  const rows = await db.select({
    id: users.id,
    name: users.firstName,
    lastName: users.lastName,
    email: users.email,
    role: roles.label,
    isActive: users.isActive,
    lastLoginAt: users.lastLoginAt
  }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).orderBy(desc(users.createdAt));
  return <main className="admin-content"><h1 className="admin-title">Пользователи админки</h1><p className="admin-subtitle">Роли и доступ к разделам CRM.</p><section className="panel" style={{ marginBottom: 20 }}><h2>Новый пользователь</h2><UserCreateForm /></section><section className="panel"><table className="data-table"><thead><tr><th>Пользователь</th><th>Роль</th><th>Последний вход</th><th>Статус</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name} {row.lastName}</strong><br />{row.email}</td><td>{row.role}</td><td>{row.lastLoginAt?.toLocaleString("ru-RU") ?? "Не входил"}</td><td><span className={`badge ${row.isActive ? "" : "badge-warn"}`}>{row.isActive ? "Активен" : "Заблокирован"}</span></td></tr>)}</tbody></table></section></main>;
}
