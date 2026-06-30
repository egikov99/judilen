import { redirect } from "next/navigation";
import { UserAccessManager } from "@/components/admin/user-access-manager";
import { getAdminUsersData } from "@/lib/admin-users-data";
import { getSessionAccess } from "@/lib/session";

export default async function UsersPage() {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  if (!access.permissions.includes("users.read")) redirect("/admin?forbidden=1");
  const data = await getAdminUsersData();
  return <main className="admin-content">
    <h1 className="admin-title">Пользователи и доступы</h1>
    <p className="admin-subtitle">Управление сотрудниками, ролями и индивидуальными правами CRM.</p>
    <UserAccessManager
      initialUsers={data.users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null }))}
      roles={data.roles}
      permissions={data.permissions}
      initialAuditLogs={data.auditLogs.map((log) => ({ ...log, createdAt: log.createdAt.toISOString() }))}
      currentUserId={access.session.userId}
      currentPermissions={access.permissions}
    />
  </main>;
}
