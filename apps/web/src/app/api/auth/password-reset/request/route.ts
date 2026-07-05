import { createHash, randomBytes } from "node:crypto";
import { db, passwordResetTokens, users } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const schema = z.object({ email: z.email().max(254).transform((value) => value.toLowerCase().trim()) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const rate = await checkRateLimit(request, {
    scope: "auth.password-reset.request",
    limit: 5,
    windowMs: 60 * 60_000,
    identifier: parsed.success ? parsed.data.email : null
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  if (!parsed.success) return Response.json({ ok: true }, { status: 202 });
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await db.transaction(async (tx) => {
      await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
      await tx.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000)
      });
    });
    const base = process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await sendPasswordResetEmail(user.email, `${base}/reset-password#token=${encodeURIComponent(token)}`);
  }
  return Response.json({ ok: true }, { status: 202 });
}
