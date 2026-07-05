import { hash } from "@node-rs/argon2";
import { db, roles, users } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { getAdminUsersData, replaceUserPermissions, staffRoles } from "@/lib/admin-users-data";
import { getSessionAccess, requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const createUserSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(10).max(128).optional(),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(30).nullable().optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  role: z.enum(staffRoles),
  isActive: z.boolean().default(true),
  permissions: z.array(z.string().max(100)).optional()
});

function temporaryPassword() {
  return `Jd!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`;
}

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

export async function GET() {
  const auth = await requirePermission("users.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json(await getAdminUsersData());
}

export async function POST(request: Request) {
  const auth = await requirePermission("users.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  if (
    auth.session.role !== "super_admin"
    && roleRank[parsed.data.role] >= roleRank[auth.session.role]
  ) return problem(403, "Нельзя создать пользователя с равной или более высокой ролью");
  if (parsed.data.permissions && auth.session.role !== "super_admin") {
    const access = await getSessionAccess();
    const allowed = new Set<string>(access?.permissions ?? []);
    if (parsed.data.permissions.some((permission) => !allowed.has(permission))) {
      return problem(403, "Нельзя назначить разрешения, которых нет у текущего пользователя");
    }
  }
  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, parsed.data.role)).limit(1);
  if (!role) return problem(422, "Роль не найдена");
  const password = parsed.data.password || temporaryPassword();
  try {
    const [user] = await db.insert(users).values({
      email: parsed.data.email, passwordHash: await hash(password), firstName: parsed.data.firstName,
      lastName: parsed.data.lastName, phone: parsed.data.phone, internalNote: parsed.data.internalNote,
      roleId: role.id, isActive: parsed.data.isActive
    }).returning();
    if (parsed.data.permissions) await replaceUserPermissions(user.id, role.id, parsed.data.role, parsed.data.permissions);
    await writeAudit({ session: auth.session, request, action: "user.create", entityType: "user", entityId: user.id, after: { ...user, passwordHash: undefined, permissions: parsed.data.permissions } });
    return Response.json({
      item: userResponse(user, parsed.data.role, parsed.data.permissions),
      temporaryPassword: parsed.data.password ? null : password
    }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return problem(409, "Пользователь уже существует");
    throw error;
  }
}
