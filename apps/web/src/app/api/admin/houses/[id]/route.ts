import { db, houseImages, houses } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { houseSchema, problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("houses.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [house] = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const images = await db.select().from(houseImages).where(eq(houseImages.houseId, id)).orderBy(asc(houseImages.position));
  return Response.json({ item: { ...house, images } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("houses.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = houseSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
  if (!before) return problem(404, "Домик не найден");
  const { basePrice, ...data } = parsed.data;
  const values = {
    ...data,
    ...(basePrice === undefined ? {} : { basePrice: String(basePrice) }),
    updatedAt: new Date()
  };
  const [after] = await db.update(houses).set(values).where(eq(houses.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "house.update", entityType: "house", entityId: id, before, after });
  revalidateTag("houses", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("houses.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
  if (!before) return problem(404, "Домик не найден");
  const [after] = await db.update(houses).set({ isPublished: false, updatedAt: new Date() }).where(eq(houses.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "house.unpublish", entityType: "house", entityId: id, before, after });
  revalidateTag("houses", "max");
  return Response.json({ item: after });
}
