import { db, smtpSettings } from "@judilen/db";
import { eq } from "drizzle-orm";
import { SMTP_SETTINGS_ID, verifySmtpConnection } from "@/lib/email";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  try {
    await verifySmtpConnection();
    await db.update(smtpSettings).set({
      status: "connected", lastError: null, lastCheckedAt: new Date(), updatedAt: new Date()
    }).where(eq(smtpSettings.id, SMTP_SETTINGS_ID));
    return Response.json({ ok: true, status: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Ошибка SMTP";
    await db.update(smtpSettings).set({
      status: "error", lastError: message, lastCheckedAt: new Date(), updatedAt: new Date()
    }).where(eq(smtpSettings.id, SMTP_SETTINGS_ID));
    return problem(503, "Не удалось подключиться к SMTP", message);
  }
}
