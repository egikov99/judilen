import "server-only";

import {
  db,
  permissions,
  rolePermissions,
  roles,
  userPermissionOverrides,
  users
} from "@judilen/db";
import { and, eq, inArray, ne } from "drizzle-orm";

export async function userIdsWithPermission(permissionKey: string) {
  const [permission] = await db.select({ id: permissions.id }).from(permissions)
    .where(eq(permissions.key, permissionKey))
    .limit(1);
  if (!permission) return [];
  const candidates = await db.select({
    id: users.id,
    roleId: users.roleId,
    role: roles.name
  }).from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.isActive, true), ne(roles.name, "client")));
  if (!candidates.length) return [];

  const [roleRows, overrideRows] = await Promise.all([
    db.select({ roleId: rolePermissions.roleId }).from(rolePermissions)
      .where(eq(rolePermissions.permissionId, permission.id)),
    db.select({
      userId: userPermissionOverrides.userId,
      isGranted: userPermissionOverrides.isGranted
    }).from(userPermissionOverrides)
      .where(and(
        eq(userPermissionOverrides.permissionId, permission.id),
        inArray(userPermissionOverrides.userId, candidates.map((item) => item.id))
      ))
  ]);
  const grantedRoles = new Set(roleRows.map((item) => item.roleId));
  const overrides = new Map(overrideRows.map((item) => [item.userId, item.isGranted]));
  return candidates
    .filter((user) => user.role === "super_admin" || (overrides.get(user.id) ?? grantedRoles.has(user.roleId)))
    .map((user) => user.id);
}
