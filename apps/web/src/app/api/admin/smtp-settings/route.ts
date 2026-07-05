import { db, emailLogs, smtpSettings } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { encryptCredentials } from "@/lib/credential-cipher";
import { diagnoseSmtpConnection, getSmtpSettings, logSmtpDiagnostic, sendTemplatedEmail, SMTP_SETTINGS_ID } from "@/lib/email";
import { requirePermission } from "@/lib/session";
import { classifySmtpError } from "@/lib/smtp-diagnostics";
import { problem } from "@/lib/validation";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { assertSafeSmtpTarget } from "@/lib/network-security";
import { writeAudit } from "@/lib/audit";
import { redactSensitiveText } from "@/lib/redaction";

const schema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().max(255).optional().default(""),
  password: z.string().max(1000).optional().default(""),
  encryption: z.enum(["none", "ssl", "starttls"]),
  fromEmail: z.email().max(254),
  fromName: z.string().trim().min(1).max(160),
  replyToEmail: z.union([z.email().max(254), z.literal("")]).optional().default(""),
  testRecipient: z.union([z.email().max(254), z.literal("")]).optional().default("")
});

function maskIdentifier(value: string | null) {
  if (!value) return "";
  const at = value.indexOf("@");
  if (at > 0) return `${value.slice(0, 1)}•••${value.slice(Math.max(1, at - 1))}`;
  return value.length <= 4 ? "••••" : `${value.slice(0, 2)}•••${value.slice(-2)}`;
}

export async function GET() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const settings = await getSmtpSettings();
  const errors = await db.select({
    id: emailLogs.id,
    recipient: emailLogs.recipient,
    templateKey: emailLogs.templateKey,
    errorMessage: emailLogs.errorMessage,
    createdAt: emailLogs.createdAt
  }).from(emailLogs).where(eq(emailLogs.status, "failed")).orderBy(desc(emailLogs.createdAt)).limit(10);
  const safeErrors = errors.map((error) => ({
    ...error,
    recipient: redactSensitiveText(error.recipient),
    errorMessage: redactSensitiveText(error.errorMessage)
  }));
  if (!settings) return Response.json({ item: null, errors: safeErrors });
  return Response.json({
    item: {
      host: settings.host,
      port: settings.port,
      username: "",
      hasUsername: Boolean(settings.username),
      usernamePreview: maskIdentifier(settings.username),
      encryption: settings.encryption,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyToEmail: settings.replyToEmail ?? "",
      hasPassword: Boolean(settings.passwordEncrypted || process.env.SMTP_PASSWORD),
      status: settings.status,
      lastError: settings.lastError ? redactSensitiveText(settings.lastError) : null,
      lastCheckedAt: settings.lastCheckedAt
    },
    errors: safeErrors
  });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, {
    scope: "smtp.settings",
    limit: 10,
    windowMs: 10 * 60_000,
    identifier: auth.session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте SMTP-настройки", parsed.error.flatten());
  try {
    await assertSafeSmtpTarget(parsed.data.host, parsed.data.port);
  } catch (error) {
    return problem(422, "Небезопасный SMTP-адрес", error instanceof Error ? error.message : undefined);
  }
  const [existing] = await db.select({
    username: smtpSettings.username,
    passwordEncrypted: smtpSettings.passwordEncrypted
  })
    .from(smtpSettings).where(eq(smtpSettings.id, SMTP_SETTINGS_ID)).limit(1);
  const passwordEncrypted = parsed.data.password
    ? encryptCredentials({ password: parsed.data.password })
    : existing?.passwordEncrypted ?? null;
  const values = {
    host: parsed.data.host,
    port: parsed.data.port,
    username: parsed.data.username || existing?.username || process.env.SMTP_USER || null,
    passwordEncrypted,
    encryption: parsed.data.encryption,
    fromEmail: parsed.data.fromEmail,
    fromName: parsed.data.fromName,
    replyToEmail: parsed.data.replyToEmail || null,
    status: "saved",
    lastError: null,
    updatedAt: new Date()
  };
  await db.insert(smtpSettings).values({ id: SMTP_SETTINGS_ID, ...values })
    .onConflictDoUpdate({ target: smtpSettings.id, set: values });
  await writeAudit({
    session: auth.session,
    request,
    action: "smtp.settings_update",
    entityType: "smtp_settings",
    entityId: SMTP_SETTINGS_ID,
    after: {
      host: parsed.data.host,
      port: parsed.data.port,
      encryption: parsed.data.encryption,
      usernameChanged: Boolean(parsed.data.username),
      passwordChanged: Boolean(parsed.data.password),
      fromEmail: parsed.data.fromEmail
    }
  });
  try {
    const diagnostic = await diagnoseSmtpConnection();
    if (parsed.data.testRecipient) {
      const result = await sendTemplatedEmail({
        to: parsed.data.testRecipient,
        templateKey: "booking_received",
        variables: {
          customerName: auth.session.name,
          bookingNumber: "SMTP-TEST",
          houseName: "Тестовое письмо",
          checkInDate: "01.08.2026",
          checkOutDate: "03.08.2026"
        },
        dedupeKey: `smtp-save-test:${auth.session.userId}:${Date.now()}`
      });
      if (!result.sent) throw result.diagnostic ?? new Error(result.error ?? "Тестовое письмо не отправлено");
      diagnostic.checks.push({ stage: "send", status: "passed", message: `Тестовое письмо отправлено на ${parsed.data.testRecipient}.` });
    }
    await db.update(smtpSettings).set({
      status: "connected", lastError: null, lastCheckedAt: new Date(), updatedAt: new Date()
    }).where(eq(smtpSettings.id, SMTP_SETTINGS_ID));
    return Response.json({
      success: true,
      settingsSaved: true,
      hasPassword: Boolean(passwordEncrypted),
      status: "connected",
      title: "Настройки сохранены",
      message: "Подключение установлено. Авторизация прошла успешно. SMTP готов к отправке писем.",
      recipient: parsed.data.testRecipient || undefined,
      checks: diagnostic.checks
    });
  } catch (error) {
    const diagnostic = classifySmtpError(error);
    logSmtpDiagnostic("SMTP verification after settings save failed", error, diagnostic);
    await db.update(smtpSettings).set({
      status: "error", lastError: diagnostic.details, lastCheckedAt: new Date(), updatedAt: new Date()
    }).where(eq(smtpSettings.id, SMTP_SETTINGS_ID));
    return Response.json({ ...diagnostic, settingsSaved: true, hasPassword: Boolean(passwordEncrypted) }, { status: 503 });
  }
}
