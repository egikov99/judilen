import { hash } from "@node-rs/argon2";
import { db, roles, users } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const createUserSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(10).max(128),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z.string().trim().max(30).optional(),
  role: z.enum(["admin", "content_manager", "manager"])
});

export async function GET() {
  const auth = await requirePermission("users.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const items = await db.select({
    id: users.id,
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
    phone: users.phone,
    isActive: users.isActive,
    role: roles.name,
    lastLoginAt: users.lastLoginAt,
    createdAt: users.createdAt
  }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).orderBy(desc(users.createdAt));
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requirePermission("users.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, parsed.data.role)).limit(1);
  if (!role) return problem(422, "Роль не найдена");
  try {
    const [user] = await db.insert(users).values({
      email: parsed.data.email,
      passwordHash: await hash(parsed.data.password),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      roleId: role.id
    }).returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName });
    await writeAudit({ session: auth.session, request, action: "user.create", entityType: "user", entityId: user.id, after: user });
    return Response.json({ item: user }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return problem(409, "Пользователь уже существует");
    throw error;
  }
}

