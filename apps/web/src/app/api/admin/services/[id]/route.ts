import { db, serviceHouses, serviceOptions, services } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePermission } from "@/lib/session";
import { problem, serviceSchema } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!service) return problem(404, "Услуга не найдена");
  const [options, houses] = await Promise.all([
    db.select().from(serviceOptions).where(eq(serviceOptions.serviceId, id)),
    db.select().from(serviceHouses).where(eq(serviceHouses.serviceId, id))
  ]);
  return Response.json({ item: service, options, houseIds: houses.map((item) => item.houseId) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!before) return problem(404, "Услуга не найдена");
  const { houseIds, basePrice, imageUrl, ...data } = parsed.data;
  const [after] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(services).set({
      ...data,
      ...(basePrice === undefined ? {} : { basePrice: String(basePrice) }),
      ...(imageUrl === undefined ? {} : { imageUrl: normalizeImageUrl(imageUrl) }),
      updatedAt: new Date()
    }).where(eq(services.id, id)).returning();
    if (houseIds) {
      await tx.delete(serviceHouses).where(eq(serviceHouses.serviceId, id));
      if (houseIds.length) await tx.insert(serviceHouses).values(houseIds.map((houseId) => ({ serviceId: id, houseId })));
    }
    return [updated];
  });
  await writeAudit({ session: auth.session, request, action: "service.update", entityType: "service", entityId: id, before, after });
  revalidateTag("services", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!before) return problem(404, "Услуга не найдена");
  await db.delete(services).where(eq(services.id, id));
  await writeAudit({ session: auth.session, request, action: "service.delete", entityType: "service", entityId: id, before });
  revalidateTag("services", "max");
  return Response.json({ ok: true });
}
