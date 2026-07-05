import { db, integrations } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isEnabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional()
}).refine((value) => Object.keys(value).length > 0, "Нет изменений");

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
  if (!before) return problem(404, "Интеграция не найдена");
  const [after] = await db.update(integrations).set({ ...parsed.data, updatedAt: new Date() }).where(eq(integrations.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "integration.update", entityType: "integration", entityId: id, before, after });
  return Response.json({ item: {
    id: after.id,
    kind: after.kind,
    name: after.name,
    isEnabled: after.isEnabled
  } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("integrations.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(integrations).where(eq(integrations.id, id)).limit(1);
  if (!before) return problem(404, "Интеграция не найдена");
  await db.delete(integrations).where(eq(integrations.id, id));
  await writeAudit({ session: auth.session, request, action: "integration.delete", entityType: "integration", entityId: id, before });
  return new Response(null, { status: 204 });
}
