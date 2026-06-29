import { bookings, calendarConflicts, db } from "@judilen/db";
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { syncExternalCalendar } from "@/lib/integration-sync";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const resolveSchema = z.object({
  action: z.enum(["keep_crm", "accept_external"]),
  note: z.string().trim().max(2000).default("")
});
const activeStatuses = ["pending", "awaiting_confirmation", "confirmed", "awaiting_payment", "paid", "external", "blocked"] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("calendar_conflicts.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = resolveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(calendarConflicts).where(eq(calendarConflicts.id, id)).limit(1);
  if (!before) return problem(404, "Конфликт не найден");
  if (before.status !== "open") return problem(409, "Конфликт уже разрешён");

  const after = await db.transaction(async (tx) => {
    if (parsed.data.action === "accept_external") {
      await tx.update(bookings).set({
        status: "cancelled",
        cancellationReason: `Конфликт внешнего календаря: ${before.source}`,
        updatedAt: new Date()
      }).where(and(
        eq(bookings.houseId, before.houseId),
        inArray(bookings.status, activeStatuses),
        lt(bookings.checkIn, before.endDate),
        gt(bookings.checkOut, before.startDate)
      ));
    }
    const [resolved] = await tx.update(calendarConflicts).set({
      status: parsed.data.action === "accept_external" ? "resolved_accept_external" : "resolved_keep_crm",
      resolvedBy: auth.session.userId,
      resolvedAt: new Date(),
      resolutionNote: parsed.data.note,
      updatedAt: new Date()
    }).where(eq(calendarConflicts.id, id)).returning();
    return resolved;
  });
  let syncError: string | null = null;
  if (parsed.data.action === "accept_external") {
    try {
      await syncExternalCalendar(before.externalCalendarId);
    } catch (error) {
      syncError = error instanceof Error ? error.message : "Ошибка синхронизации";
    }
  }
  await writeAudit({ session: auth.session, request, action: "calendar_conflict.resolve", entityType: "calendar_conflict", entityId: id, before, after });
  return Response.json({ item: after, syncError });
}
