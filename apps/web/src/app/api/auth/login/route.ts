import { verify } from "@node-rs/argon2";
import { createSessionToken, SESSION_COOKIE } from "@judilen/auth";
import { db, roles, users } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { loginSchema, problem } from "@/lib/validation";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const dummyPasswordHash = "$argon2id$v=19$m=19456,t=2,p=1$CV8u3HtBGBBEO7YpMYRbtA$6dQFcxN6M8QgJSoRLcfIKv5UmqGd06t0yMJblk865MA";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await request.json().catch(() => null));
    const rate = await checkRateLimit(request, {
      scope: "auth.login",
      limit: 10,
      windowMs: 15 * 60_000,
      identifier: parsed.success ? parsed.data.email : null
    });
    if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
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
    const passwordMatches = await verify(row?.passwordHash ?? dummyPasswordHash, parsed.data.password);
    if (!row || !passwordMatches) {
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
  } catch (error) {
    console.error("auth_login_failed", error);
    return problem(503, "Сервис авторизации временно недоступен. Попробуйте ещё раз.");
  }
}
