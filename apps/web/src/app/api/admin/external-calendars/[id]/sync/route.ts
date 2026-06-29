import { writeAudit } from "@/lib/audit";
import { syncExternalCalendar } from "@/lib/integration-sync";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("external_calendars.sync");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  try {
    const result = await syncExternalCalendar(id);
    await writeAudit({ session: auth.session, request, action: "external_calendar.sync", entityType: "external_calendar", entityId: id, after: result });
    return Response.json(result);
  } catch (error) {
    return problem(502, "Не удалось синхронизировать календарь", error instanceof Error ? error.message : undefined);
  }
}
