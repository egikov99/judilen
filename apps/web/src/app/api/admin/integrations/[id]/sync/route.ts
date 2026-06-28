import { writeAudit } from "@/lib/audit";
import { syncIcalIntegration } from "@/lib/integration-sync";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("integrations.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  try {
    const result = await syncIcalIntegration(id);
    await writeAudit({ session: auth.session, request, action: "integration.sync", entityType: "integration", entityId: id, after: result });
    return Response.json(result);
  } catch (error) {
    console.error("integration_sync_failed", { id, error });
    return problem(502, "Синхронизация не выполнена", error instanceof Error ? error.message : undefined);
  }
}

