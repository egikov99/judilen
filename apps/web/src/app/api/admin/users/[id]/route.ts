import { db, roles, userPermissionOverrides, users } from "@judilen/db";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { replaceUserPermissions, staffRoles } from "@/lib/admin-users-data";
import { getSessionAccess, requirePermission } from "@/lib/session";
import { removesLastSuperAdmin } from "@/lib/user-access-rules";
import { problem } from "@/lib/validation";

const schema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(staffRoles).optional(),
  permissions: z.array(z.string().max(100)).optional()
}).refine((value) => Object.keys(value).length > 0);

const roleRank: Record<string, number> = {
  viewer: 1,
  content_manager: 2,
  manager: 3,
  admin: 4,
  super_admin: 5
};

function userResponse(user: typeof users.$inferSelect, role: string, permissions?: string[]) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    internalNote: user.internalNote,
    isActive: user.isActive,
    roleId: user.roleId,
    role,
    permissions,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt
  };
}

async function activeSuperAdminCount() {
  const [row] = await db.select({ value: count() }).from(users).innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(roles.name, "super_admin"), eq(users.isActive, true)));
  return row.value;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("users.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  if (id === auth.session.userId && parsed.data.isActive === false) return problem(409, "Нельзя заблокировать собственный аккаунт");
  const [before] = await db.select({
    id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
    phone: users.phone, internalNote: users.internalNote, isActive: users.isActive,
    roleId: users.roleId, role: roles.name
  }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, id)).limit(1);
  if (!before) return problem(404, "Пользователь не найден");
  if (
    auth.session.role !== "super_admin"
    && (
      roleRank[before.role] >= roleRank[auth.session.role]
      || roleRank[parsed.data.role ?? before.role] >= roleRank[auth.session.role]
    )
  ) return problem(403, "Нельзя изменять пользователя с равной или более высокой ролью");
  if (parsed.data.permissions && auth.session.role !== "super_admin") {
    const access = await getSessionAccess();
    const allowed = new Set<string>(access?.permissions ?? []);
    if (parsed.data.permissions.some((permission) => !allowed.has(permission))) {
      return problem(403, "Нельзя назначить разрешения, которых нет у текущего пользователя");
    }
  }
  if (removesLastSuperAdmin({
    currentRole: before.role,
    currentActive: before.isActive,
    nextRole: parsed.data.role,
    nextActive: parsed.data.isActive,
    activeSuperAdmins: await activeSuperAdminCount()
  })) return problem(409, "Нельзя заблокировать или понизить последнего Super Admin");

  let roleId = before.roleId;
  const nextRole = parsed.data.role ?? before.role;
  if (parsed.data.role) {
    const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, parsed.data.role)).limit(1);
    if (!role) return problem(422, "Роль не найдена");
    roleId = role.id;
  }
  try {
    const [after] = await db.update(users).set({
      firstName: parsed.data.firstName, lastName: parsed.data.lastName, email: parsed.data.email,
      phone: parsed.data.phone, internalNote: parsed.data.internalNote, isActive: parsed.data.isActive,
      roleId, updatedAt: new Date()
    }).where(eq(users.id, id)).returning();
    if (parsed.data.permissions) await replaceUserPermissions(id, roleId, nextRole, parsed.data.permissions);
    else if (parsed.data.role) await db.delete(userPermissionOverrides).where(eq(userPermissionOverrides.userId, id));
    const actions = [
      parsed.data.role && parsed.data.role !== before.role ? "user.role_update" : null,
      parsed.data.permissions ? "user.permissions_update" : null,
      parsed.data.isActive !== undefined && parsed.data.isActive !== before.isActive ? "user.status_update" : null
    ].filter((action): action is string => Boolean(action));
    for (const action of actions.length ? actions : ["user.update"]) {
      await writeAudit({ session: auth.session, request, action, entityType: "user", entityId: id, before, after: { ...after, passwordHash: undefined, permissions: parsed.data.permissions } });
    }
    return Response.json({ item: userResponse(after, nextRole, parsed.data.permissions) });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return problem(409, "Email уже используется");
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("users.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  if (id === auth.session.userId) return problem(409, "Нельзя удалить собственный аккаунт");
  const [before] = await db.select({ user: users, role: roles.name }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, id)).limit(1);
  if (!before) return problem(404, "Пользователь не найден");
  if (auth.session.role !== "super_admin" && roleRank[before.role] >= roleRank[auth.session.role]) {
    return problem(403, "Нельзя удалить пользователя с равной или более высокой ролью");
  }
  if (before.role === "super_admin" && before.user.isActive && await activeSuperAdminCount() <= 1) return problem(409, "Нельзя удалить последнего Super Admin");
  await db.delete(users).where(eq(users.id, id));
  await writeAudit({ session: auth.session, request, action: "user.delete", entityType: "user", entityId: id, before: { ...before.user, passwordHash: undefined, role: before.role } });
  return new Response(null, { status: 204 });
}
