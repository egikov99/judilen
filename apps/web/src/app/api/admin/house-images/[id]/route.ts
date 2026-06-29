import { db, houseImages } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { houseImageSchema, problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("house_images.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = houseImageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(houseImages).where(eq(houseImages.id, id)).limit(1);
  if (!before) return problem(404, "Фото не найдено");
  const [after] = await db.transaction(async (tx) => {
    if (parsed.data.isMain) await tx.update(houseImages).set({ isMain: false }).where(eq(houseImages.houseId, before.houseId));
    const [updated] = await tx.update(houseImages).set({
      ...parsed.data,
      caption: parsed.data.caption === undefined ? before.caption : parsed.data.caption || null,
      updatedAt: new Date()
    }).where(eq(houseImages.id, id)).returning();
    return [updated];
  });
  await writeAudit({ session: auth.session, request, action: "house_image.update", entityType: "house_image", entityId: id, before, after });
  revalidateTag("houses", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("house_images.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(houseImages).where(eq(houseImages.id, id)).limit(1);
  if (!before) return problem(404, "Фото не найдено");
  await db.delete(houseImages).where(eq(houseImages.id, id));
  await writeAudit({ session: auth.session, request, action: "house_image.delete", entityType: "house_image", entityId: id, before });
  revalidateTag("houses", "max");
  return Response.json({ ok: true });
}
