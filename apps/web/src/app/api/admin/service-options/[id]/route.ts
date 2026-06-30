import { db, serviceOptions } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem, serviceOptionSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("service_options.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceOptionSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(serviceOptions).where(eq(serviceOptions.id, id)).limit(1);
  if (!before) return problem(404, "Вариант не найден");
  const { price, description, ...data } = parsed.data;
  const [after] = await db.transaction(async (tx) => {
    if (data.isDefault) await tx.update(serviceOptions).set({ isDefault: false }).where(eq(serviceOptions.serviceId, before.serviceId));
    const [updated] = await tx.update(serviceOptions).set({
      ...data,
      ...(price === undefined ? {} : { price: String(price) }),
      ...(description === undefined ? {} : { description: description || null }),
      updatedAt: new Date()
    }).where(eq(serviceOptions.id, id)).returning();
    return [updated];
  });
  await writeAudit({ session: auth.session, request, action: "service_option.update", entityType: "service_option", entityId: id, before, after });
  revalidateTag("services", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("service_options.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(serviceOptions).where(eq(serviceOptions.id, id)).limit(1);
  if (!before) return problem(404, "Вариант не найден");
  await db.delete(serviceOptions).where(eq(serviceOptions.id, id));
  await writeAudit({ session: auth.session, request, action: "service_option.delete", entityType: "service_option", entityId: id, before });
  revalidateTag("services", "max");
  return Response.json({ ok: true });
}
