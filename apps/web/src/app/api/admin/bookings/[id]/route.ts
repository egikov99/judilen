import { bookingStatusHistory, bookings, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { bookingUpdateSchema, problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("bookings.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = bookingUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!before) return problem(404, "Бронирование не найдено");
  const { paidAmount, ...data } = parsed.data;
  const [after] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(bookings).set({
      ...data,
      ...(paidAmount === undefined ? {} : { paidAmount: String(paidAmount) }),
      updatedAt: new Date()
    }).where(eq(bookings.id, id)).returning();
    if (parsed.data.status && parsed.data.status !== before.status) {
      await tx.insert(bookingStatusHistory).values({
        bookingId: id,
        fromStatus: before.status,
        toStatus: parsed.data.status,
        changedBy: auth.session.userId,
        comment: parsed.data.managerComment ?? undefined
      });
    }
    return [updated];
  });
  await writeAudit({ session: auth.session, request, action: "booking.update", entityType: "booking", entityId: id, before, after });
  return Response.json({ item: after });
}
