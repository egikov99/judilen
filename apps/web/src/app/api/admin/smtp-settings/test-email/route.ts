import { sendTemplatedEmail } from "@/lib/email";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const result = await sendTemplatedEmail({
    to: auth.session.email,
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
  if (!result.sent) return problem(503, "Тестовое письмо не отправлено", result.error);
  return Response.json({ ok: true, recipient: auth.session.email });
}
