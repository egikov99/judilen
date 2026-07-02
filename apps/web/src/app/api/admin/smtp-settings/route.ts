import { db, emailLogs, smtpSettings } from "@judilen/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { encryptCredentials } from "@/lib/credential-cipher";
import { getSmtpSettings, SMTP_SETTINGS_ID } from "@/lib/email";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().max(255).optional().default(""),
  password: z.string().max(1000).optional().default(""),
  encryption: z.enum(["none", "ssl", "starttls"]),
  fromEmail: z.email().max(254),
  fromName: z.string().trim().min(1).max(160),
  replyToEmail: z.union([z.email().max(254), z.literal("")]).optional().default("")
});

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
  if (!settings) return Response.json({ item: null, errors });
  return Response.json({
    item: {
      host: settings.host,
      port: settings.port,
      username: settings.username ?? "",
      encryption: settings.encryption,
      fromEmail: settings.fromEmail,
      fromName: settings.fromName,
      replyToEmail: settings.replyToEmail ?? "",
      hasPassword: Boolean(settings.passwordEncrypted || process.env.SMTP_PASSWORD),
      status: settings.status,
      lastError: settings.lastError,
      lastCheckedAt: settings.lastCheckedAt
    },
    errors
  });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте SMTP-настройки", parsed.error.flatten());
  const [existing] = await db.select({ passwordEncrypted: smtpSettings.passwordEncrypted })
    .from(smtpSettings).where(eq(smtpSettings.id, SMTP_SETTINGS_ID)).limit(1);
  const passwordEncrypted = parsed.data.password
    ? encryptCredentials({ password: parsed.data.password })
    : existing?.passwordEncrypted ?? null;
  const values = {
    host: parsed.data.host,
    port: parsed.data.port,
    username: parsed.data.username || null,
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
  return Response.json({ ok: true, hasPassword: Boolean(passwordEncrypted) });
}
