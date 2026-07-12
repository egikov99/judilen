import { db, gazeboImages } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { removeUploadedFile } from "@/lib/uploads";
import { gazeboImageSchema, problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("gazebos.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = gazeboImageSchema.pick({ alt: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(gazeboImages).where(eq(gazeboImages.id, id)).limit(1);
  if (!before) return problem(404, "Фотография не найдена");
  const [after] = await db.update(gazeboImages).set({ alt: parsed.data.alt, updatedAt: new Date() }).where(eq(gazeboImages.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "gazebo_image.update", entityType: "gazebo_image", entityId: id, before, after });
  revalidateTag("gazebos", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("gazebos.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(gazeboImages).where(eq(gazeboImages.id, id)).limit(1);
  if (!before) return problem(404, "Фотография не найдена");
  await db.transaction(async (tx) => {
    await tx.delete(gazeboImages).where(eq(gazeboImages.id, id));
    const remaining = await tx.select().from(gazeboImages)
      .where(eq(gazeboImages.gazeboId, before.gazeboId))
      .orderBy(asc(gazeboImages.sortOrder));
    for (const [index, image] of remaining.entries()) {
      await tx.update(gazeboImages).set({ sortOrder: -(index + 1), updatedAt: new Date() }).where(eq(gazeboImages.id, image.id));
    }
    for (const [index, image] of remaining.entries()) {
      await tx.update(gazeboImages).set({ sortOrder: index, updatedAt: new Date() }).where(eq(gazeboImages.id, image.id));
    }
  });
  await removeUploadedFile(before.url);
  await writeAudit({ session: auth.session, request, action: "gazebo_image.delete", entityType: "gazebo_image", entityId: id, before });
  revalidateTag("gazebos", "max");
  return Response.json({ ok: true });
}
