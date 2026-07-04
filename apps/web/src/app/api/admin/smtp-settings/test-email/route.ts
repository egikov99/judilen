import { logSmtpDiagnostic, sendTemplatedEmail } from "@/lib/email";
import { requirePermission } from "@/lib/session";
import { classifySmtpError } from "@/lib/smtp-diagnostics";
import { problem } from "@/lib/validation";
import { z } from "zod";

const schema = z.object({ recipient: z.email().max(254).optional() });

export async function POST(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return problem(422, "Укажите корректный адрес для тестового письма");
  const recipient = parsed.data.recipient ?? auth.session.email;
  try {
    const result = await sendTemplatedEmail({
      to: recipient,
      templateKey: "booking_received",
      variables: {
        customerName: auth.session.name,
        bookingNumber: "TEST-001",
        houseName: "Тестовый домик",
        checkInDate: "01.08.2026",
        checkOutDate: "03.08.2026"
      },
      dedupeKey: `smtp-test:${auth.session.userId}:${Date.now()}`
    });
    if (!result.sent) throw result.diagnostic ?? new Error(result.error ?? "Тестовое письмо не отправлено");
    return Response.json({
      success: true,
      title: "Тестовое письмо отправлено",
      message: `SMTP-сервер принял письмо для ${recipient}.`,
      recipient,
      checks: [{ stage: "send", status: "passed", message: `Письмо отправлено на ${recipient}.` }]
    });
  } catch (error) {
    const diagnostic = classifySmtpError(error, "send");
    logSmtpDiagnostic("SMTP test email failed", error, diagnostic);
    return Response.json(diagnostic, { status: 503 });
  }
}
