import { verify } from "@node-rs/argon2";
import { createSessionToken, SESSION_COOKIE } from "@judilen/auth";
import { db, roles, users } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { loginSchema, problem } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте email и пароль", parsed.error.flatten());
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      firstName: users.firstName,
      lastName: users.lastName,
      sessionVersion: users.sessionVersion,
      role: roles.name
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(and(eq(users.email, parsed.data.email), eq(users.isActive, true)))
    .limit(1);
  if (!row || !(await verify(row.passwordHash, parsed.data.password))) {
    return problem(401, "Неверный email или пароль");
  }
  const token = await createSessionToken({
    userId: row.id,
    email: row.email,
    name: `${row.firstName} ${row.lastName}`.trim(),
    role: row.role,
    sessionVersion: row.sessionVersion
  });
  const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 604800);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl
  });
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, row.id));
  return Response.json({ user: { id: row.id, email: row.email, name: row.firstName, role: row.role } });
}
