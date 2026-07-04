import { db, serviceImages } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { removeUploadedFile } from "@/lib/uploads";
import { problem, serviceImageSchema } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceImageSchema.pick({ alt: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный alt-текст", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(serviceImages).where(eq(serviceImages.id, id)).limit(1);
  if (!before) return problem(404, "Фото не найдено");
  const [after] = await db.update(serviceImages).set({ alt: parsed.data.alt, updatedAt: new Date() }).where(eq(serviceImages.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "service_image.update", entityType: "service_image", entityId: id, before, after });
  revalidateTag("services", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(serviceImages).where(eq(serviceImages.id, id)).limit(1);
  if (!before) return problem(404, "Фото не найдено");
  await db.transaction(async (tx) => {
    await tx.delete(serviceImages).where(eq(serviceImages.id, id));
    const remaining = await tx.select().from(serviceImages)
      .where(eq(serviceImages.serviceId, before.serviceId))
      .orderBy(asc(serviceImages.sortOrder));
    for (const [index, image] of remaining.entries()) {
      await tx.update(serviceImages).set({ sortOrder: -(index + 1), updatedAt: new Date() }).where(eq(serviceImages.id, image.id));
    }
    for (const [index, image] of remaining.entries()) {
      await tx.update(serviceImages).set({ sortOrder: index, updatedAt: new Date() }).where(eq(serviceImages.id, image.id));
    }
  });
  await removeUploadedFile(before.url);
  await writeAudit({ session: auth.session, request, action: "service_image.delete", entityType: "service_image", entityId: id, before });
  revalidateTag("services", "max");
  return Response.json({ ok: true });
}
