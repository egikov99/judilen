import { db, serviceHouses, serviceOptions, services } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem, serviceSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("services.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rows = await db.select({ service: services, option: serviceOptions, houseId: serviceHouses.houseId })
    .from(services)
    .leftJoin(serviceOptions, eq(serviceOptions.serviceId, services.id))
    .leftJoin(serviceHouses, eq(serviceHouses.serviceId, services.id))
    .orderBy(asc(services.sortOrder), asc(serviceOptions.sortOrder));
  return Response.json({ items: rows });
}

export async function POST(request: Request) {
  const auth = await requirePermission("services.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { houseIds, basePrice, imageUrl, ...data } = parsed.data;
  const [service] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(services).values({
      ...data,
      imageUrl: imageUrl || null,
      basePrice: String(basePrice)
    }).returning();
    if (houseIds.length) await tx.insert(serviceHouses).values(houseIds.map((houseId) => ({ serviceId: created.id, houseId })));
    return [created];
  });
  await writeAudit({ session: auth.session, request, action: "service.create", entityType: "service", entityId: service.id, after: service });
  revalidateTag("services", "max");
  return Response.json({ item: service }, { status: 201 });
}
