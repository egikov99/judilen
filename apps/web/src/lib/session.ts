import { SESSION_COOKIE, verifySessionToken, type Permission, type Session } from "@judilen/auth";
import { db, permissions, rolePermissions, roles, userPermissionOverrides, users } from "@judilen/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export interface SessionAccess {
  session: Session;
  permissions: Permission[];
}

async function loadAccess(tokenSession: Session): Promise<SessionAccess | null> {
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
    isActive: users.isActive,
    sessionVersion: users.sessionVersion,
    roleId: users.roleId,
    role: roles.name
  }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, tokenSession.userId)).limit(1);
  if (!user?.isActive || user.sessionVersion !== tokenSession.sessionVersion) return null;

  const [roleRows, overrideRows, allPermissionRows] = await Promise.all([
    db.select({ key: permissions.key }).from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, user.roleId)),
    db.select({ key: permissions.key, isGranted: userPermissionOverrides.isGranted }).from(userPermissionOverrides)
      .innerJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(eq(userPermissionOverrides.userId, user.id)),
    user.role === "super_admin" ? db.select({ key: permissions.key }).from(permissions) : Promise.resolve([])
  ]);
  const effective = new Set((user.role === "super_admin" ? allPermissionRows : roleRows).map((row) => row.key as Permission));
  if (user.role !== "super_admin") {
    for (const override of overrideRows) {
      if (override.isGranted) effective.add(override.key as Permission);
      else effective.delete(override.key as Permission);
    }
  }
  return {
    session: {
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role,
      sessionVersion: user.sessionVersion
    },
    permissions: [...effective]
  };
}

export async function getSessionAccess() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const tokenSession = token ? await verifySessionToken(token) : null;
  return tokenSession ? loadAccess(tokenSession) : null;
}

export async function getSession() {
  return (await getSessionAccess())?.session ?? null;
}

export async function requireSession() {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  return access.session;
}

export async function requirePermission(permission: Permission) {
  const access = await getSessionAccess();
  if (!access) return { error: "unauthorized" as const, session: null };
  if (!access.permissions.includes(permission)) return { error: "forbidden" as const, session: access.session };
  return { error: null, session: access.session };
}

export async function requireAllPermissions(required: Permission[]) {
  const access = await getSessionAccess();
  if (!access) return { error: "unauthorized" as const, session: null };
  if (!required.every((permission) => access.permissions.includes(permission))) return { error: "forbidden" as const, session: access.session };
  return { error: null, session: access.session };
}

export async function requirePagePermission(permission: Permission) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  if (!access.permissions.includes(permission)) redirect("/admin?forbidden=1");
  return access.session;
}

export async function requirePageAccess(permission: Permission) {
  const access = await getSessionAccess();
  if (!access) redirect("/login");
  if (!access.permissions.includes(permission)) redirect("/admin?forbidden=1");
  return access;
}
