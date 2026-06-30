import { auditLogs, db, permissions, rolePermissions, roles, userPermissionOverrides, users } from "@judilen/db";
import { desc, eq, inArray } from "drizzle-orm";
import type { Permission, Role } from "@judilen/auth";

export const staffRoles = ["super_admin", "admin", "manager", "content_manager", "viewer"] as const;
export type StaffRole = (typeof staffRoles)[number];

export async function getAdminUsersData() {
  const [userRows, roleRows, permissionRows, rolePermissionRows, overrideRows, auditRows] = await Promise.all([
    db.select({
      id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
      phone: users.phone, internalNote: users.internalNote, isActive: users.isActive,
      roleId: users.roleId, role: roles.name, roleLabel: roles.label,
      lastLoginAt: users.lastLoginAt, createdAt: users.createdAt
    }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(inArray(roles.name, staffRoles)).orderBy(desc(users.createdAt)),
    db.select().from(roles).where(inArray(roles.name, staffRoles)),
    db.select().from(permissions).orderBy(permissions.key),
    db.select().from(rolePermissions),
    db.select().from(userPermissionOverrides),
    db.select().from(auditLogs).where(eq(auditLogs.entityType, "user")).orderBy(desc(auditLogs.createdAt)).limit(100)
  ]);
  const allKeys = permissionRows.map((item) => item.key as Permission);
  const roleKeys = new Map<string, Set<string>>();
  for (const row of rolePermissionRows) {
    const set = roleKeys.get(row.roleId) ?? new Set<string>();
    const permission = permissionRows.find((item) => item.id === row.permissionId);
    if (permission) set.add(permission.key);
    roleKeys.set(row.roleId, set);
  }
  return {
    users: userRows.map((user) => {
      const effective = new Set<Permission>(user.role === "super_admin" ? allKeys : [...(roleKeys.get(user.roleId) ?? [])] as Permission[]);
      for (const override of overrideRows.filter((item) => item.userId === user.id)) {
        const permission = permissionRows.find((item) => item.id === override.permissionId);
        if (!permission) continue;
        if (override.isGranted) effective.add(permission.key as Permission);
        else effective.delete(permission.key as Permission);
      }
      return { ...user, permissions: [...effective] };
    }),
    roles: roleRows.map((role) => ({ ...role, permissions: [...(roleKeys.get(role.id) ?? [])] as Permission[] })),
    permissions: permissionRows.map((item) => ({ key: item.key as Permission, description: item.description })),
    auditLogs: auditRows
  };
}

export async function replaceUserPermissions(userId: string, roleId: string, role: Role, desiredKeys: string[]) {
  const [permissionRows, roleRows] = await Promise.all([
    db.select().from(permissions),
    db.select({ permissionId: rolePermissions.permissionId }).from(rolePermissions).where(eq(rolePermissions.roleId, roleId))
  ]);
  await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.userId, userId));
  if (role === "super_admin") return;
  const baseline = new Set(roleRows.map((item) => item.permissionId));
  const desired = new Set(desiredKeys);
  const overrides = permissionRows.flatMap((permission) => {
    const wanted = desired.has(permission.key);
    const inherited = baseline.has(permission.id);
    return wanted === inherited ? [] : [{ userId, permissionId: permission.id, isGranted: wanted }];
  });
  if (overrides.length) await db.insert(userPermissionOverrides).values(overrides);
}
