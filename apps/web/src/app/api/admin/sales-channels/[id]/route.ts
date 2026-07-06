import { bookings, db, salesChannels } from "@judilen/db";
import { count, eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { salesChannelSchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("sales_channels.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = salesChannelSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return problem(422, "Некорректные данные", parsed.success ? undefined : parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(salesChannels).where(eq(salesChannels.id, id)).limit(1);
  if (!before) return problem(404, "Канал не найден");
  const [item] = await db.update(salesChannels).set({ ...parsed.data, updatedAt: new Date() }).where(eq(salesChannels.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "sales_channel.update", entityType: "sales_channel", entityId: id, before, after: item });
  return Response.json({ item });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("sales_channels.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [usage] = await db.select({ value: count() }).from(bookings).where(eq(bookings.salesChannelId, id));
  if ((usage?.value ?? 0) > 0) return problem(409, "Канал уже использовался", "Его можно только архивировать");
  const [item] = await db.delete(salesChannels).where(eq(salesChannels.id, id)).returning();
  if (!item) return problem(404, "Канал не найден");
  await writeAudit({ session: auth.session, request, action: "sales_channel.delete", entityType: "sales_channel", entityId: id, before: item });
  return Response.json({ item });
}
