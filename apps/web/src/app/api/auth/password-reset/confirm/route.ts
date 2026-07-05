import { createHash } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { db, passwordResetTokens, users } from "@judilen/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { problem } from "@/lib/validation";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const schema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().min(10).max(128).regex(/[a-zа-я]/i).regex(/[0-9]/)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const rate = await checkRateLimit(request, {
    scope: "auth.password-reset.confirm",
    limit: 10,
    windowMs: 60 * 60_000
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  if (!parsed.success) return problem(422, "Некорректный токен или пароль");
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const [reset] = await db.select().from(passwordResetTokens).where(and(
    eq(passwordResetTokens.tokenHash, tokenHash),
    gt(passwordResetTokens.expiresAt, new Date()),
    isNull(passwordResetTokens.usedAt)
  )).limit(1);
  if (!reset) return problem(400, "Ссылка недействительна или истекла");
  await db.transaction(async (tx) => {
    await tx.update(users).set({
      passwordHash: await hash(parsed.data.password),
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date()
    }).where(eq(users.id, reset.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, reset.id));
  });
  return Response.json({ ok: true });
}
