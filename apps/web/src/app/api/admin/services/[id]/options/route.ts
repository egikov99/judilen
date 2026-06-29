import { db, serviceOptions, services } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem, serviceOptionSchema } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  return Response.json({ items: await db.select().from(serviceOptions).where(eq(serviceOptions.serviceId, id)).orderBy(asc(serviceOptions.sortOrder)) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceOptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [service] = await db.select({ id: services.id }).from(services).where(eq(services.id, id)).limit(1);
  if (!service) return problem(404, "Услуга не найдена");
  const [option] = await db.transaction(async (tx) => {
    if (parsed.data.isDefault) await tx.update(serviceOptions).set({ isDefault: false }).where(eq(serviceOptions.serviceId, id));
    const [created] = await tx.insert(serviceOptions).values({
      ...parsed.data,
      description: parsed.data.description || null,
      price: String(parsed.data.price),
      serviceId: id
    }).returning();
    return [created];
  });
  await writeAudit({ session: auth.session, request, action: "service_option.create", entityType: "service_option", entityId: option.id, after: option });
  revalidateTag("services", "max");
  return Response.json({ item: option }, { status: 201 });
}
