import { hash } from "@node-rs/argon2";
import { db, users } from "@judilen/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({ password: z.string().min(10).max(128).optional() });

function temporaryPassword() {
  return `Jd!${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}9a`;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("users.reset_password");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return problem(422, "Некорректный пароль", parsed.error.flatten());
  const { id } = await params;
  if (id === auth.session.userId) return problem(409, "Для собственного аккаунта используйте смену пароля в профиле");
  const [before] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, id)).limit(1);
  if (!before) return problem(404, "Пользователь не найден");
  const password = parsed.data.password || temporaryPassword();
  await db.update(users).set({
    passwordHash: await hash(password),
    sessionVersion: sql`${users.sessionVersion} + 1`,
    updatedAt: new Date()
  }).where(eq(users.id, id));
  await writeAudit({ session: auth.session, request, action: "user.password_reset", entityType: "user", entityId: id, before, after: { passwordReset: true, sessionsInvalidated: true } });
  return Response.json({ temporaryPassword: password });
}
