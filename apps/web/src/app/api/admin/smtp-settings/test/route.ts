import { db, smtpSettings } from "@judilen/db";
import { eq } from "drizzle-orm";
import { diagnoseSmtpConnection, logSmtpDiagnostic, sendTemplatedEmail, SMTP_SETTINGS_ID } from "@/lib/email";
import { requirePermission } from "@/lib/session";
import { classifySmtpError } from "@/lib/smtp-diagnostics";
import { problem } from "@/lib/validation";
import { z } from "zod";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const schema = z.object({ recipient: z.email().max(254).optional() });

export async function POST(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, {
    scope: "smtp.test",
    limit: 10,
    windowMs: 10 * 60_000,
    identifier: auth.session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return problem(422, "Укажите корректный адрес для тестового письма");
  const recipient = parsed.data.recipient ?? "";
  try {
    const diagnostic = await diagnoseSmtpConnection();
    if (recipient) {
      const result = await sendTemplatedEmail({
        to: recipient,
        templateKey: "booking_received",
        variables: {
          customerName: auth.session.name,
          bookingNumber: "SMTP-TEST",
          houseName: "Тестовое письмо",
          checkInDate: "01.08.2026",
          checkOutDate: "03.08.2026"
        },
        dedupeKey: `smtp-test:${auth.session.userId}:${Date.now()}`
      });
      if (!result.sent) throw result.diagnostic ?? new Error(result.error ?? "Тестовое письмо не отправлено");
      diagnostic.checks.push({ stage: "send", status: "passed", message: `Тестовое письмо отправлено на ${recipient}.` });
    }
    await db.update(smtpSettings).set({
      status: "connected", lastError: null, lastCheckedAt: new Date(), updatedAt: new Date()
    }).where(eq(smtpSettings.id, SMTP_SETTINGS_ID));
    return Response.json({
      success: true,
      status: "connected",
      title: "Подключение успешно",
      message: "Подключение установлено. Авторизация прошла успешно. SMTP готов к отправке писем.",
      recipient: recipient || undefined,
      checks: diagnostic.checks
    });
  } catch (error) {
    const diagnostic = classifySmtpError(error);
    logSmtpDiagnostic("SMTP connection test failed", error, diagnostic);
    await db.update(smtpSettings).set({
      status: "error", lastError: diagnostic.details, lastCheckedAt: new Date(), updatedAt: new Date()
    }).where(eq(smtpSettings.id, SMTP_SETTINGS_ID));
    return Response.json(diagnostic, { status: 503 });
  }
}
