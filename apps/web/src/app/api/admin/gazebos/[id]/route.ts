import { db, gazeboImages, gazebos } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePermission } from "@/lib/session";
import { removeUploadedFile } from "@/lib/uploads";
import { gazeboSchema, problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("gazebos.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [gazebo] = await db.select().from(gazebos).where(eq(gazebos.id, id)).limit(1);
  if (!gazebo) return problem(404, "Беседка не найдена");
  const images = await db.select().from(gazeboImages).where(eq(gazeboImages.gazeboId, id)).orderBy(asc(gazeboImages.sortOrder));
  return Response.json({ item: { ...gazebo, images } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("gazebos.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = gazeboSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(gazebos).where(eq(gazebos.id, id)).limit(1);
  if (!before) return problem(404, "Беседка не найдена");
  const { images: submittedImages, ...data } = parsed.data;
  const previousImages = submittedImages
    ? await db.select().from(gazeboImages).where(eq(gazeboImages.gazeboId, id))
    : [];
  const normalizedImages = submittedImages?.map((image, index) => ({
    ...image,
    url: normalizeImageUrl(image.url) ?? image.url,
    sortOrder: index
  }));
  const [after] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(gazebos).set({ ...data, updatedAt: new Date() }).where(eq(gazebos.id, id)).returning();
    if (normalizedImages) {
      await tx.delete(gazeboImages).where(eq(gazeboImages.gazeboId, id));
      if (normalizedImages.length) await tx.insert(gazeboImages).values(normalizedImages.map((image, index) => ({
        gazeboId: id,
        url: image.url,
        alt: image.alt,
        sortOrder: index
      })));
    }
    return [updated];
  });
  if (normalizedImages) {
    const retainedUrls = new Set(normalizedImages.map((image) => image.url));
    await Promise.all(previousImages.filter((image) => !retainedUrls.has(image.url)).map((image) => removeUploadedFile(image.url)));
  }
  await writeAudit({ session: auth.session, request, action: "gazebo.update", entityType: "gazebo", entityId: id, before, after });
  revalidateTag("gazebos", "max");
  return Response.json({ item: { ...after, ...(normalizedImages ? { images: normalizedImages } : {}) } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("gazebos.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(gazebos).where(eq(gazebos.id, id)).limit(1);
  if (!before) return problem(404, "Беседка не найдена");
  const images = await db.select().from(gazeboImages).where(eq(gazeboImages.gazeboId, id));
  await db.delete(gazebos).where(eq(gazebos.id, id));
  await Promise.all(images.map((image) => removeUploadedFile(image.url)));
  await writeAudit({ session: auth.session, request, action: "gazebo.delete", entityType: "gazebo", entityId: id, before });
  revalidateTag("gazebos", "max");
  return Response.json({ ok: true });
}
