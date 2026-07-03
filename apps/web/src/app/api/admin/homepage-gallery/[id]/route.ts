import { db, homepageGalleryImages } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { removeUploadedFile } from "@/lib/uploads";
import { problem } from "@/lib/validation";

const updateSchema = z.object({ alt: z.string().trim().min(2).max(300) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный alt-текст", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(homepageGalleryImages).where(eq(homepageGalleryImages.id, id)).limit(1);
  if (!before) return problem(404, "Фото не найдено");
  const [after] = await db
    .update(homepageGalleryImages)
    .set({ alt: parsed.data.alt, updatedAt: new Date() })
    .where(eq(homepageGalleryImages.id, id))
    .returning();
  await writeAudit({
    session: auth.session,
    request,
    action: "homepage_gallery_image.update",
    entityType: "homepage_gallery_image",
    entityId: id,
    before,
    after
  });
  revalidateTag("homepage-gallery", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(homepageGalleryImages).where(eq(homepageGalleryImages.id, id)).limit(1);
  if (!before) return problem(404, "Фото не найдено");

  await db.transaction(async (tx) => {
    await tx.delete(homepageGalleryImages).where(eq(homepageGalleryImages.id, id));
    const remaining = await tx
      .select()
      .from(homepageGalleryImages)
      .where(eq(homepageGalleryImages.sectionKey, before.sectionKey))
      .orderBy(asc(homepageGalleryImages.sortOrder));
    for (const [index, image] of remaining.entries()) {
      await tx
        .update(homepageGalleryImages)
        .set({ sortOrder: -(index + 1), updatedAt: new Date() })
        .where(eq(homepageGalleryImages.id, image.id));
    }
    for (const [index, image] of remaining.entries()) {
      await tx
        .update(homepageGalleryImages)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(homepageGalleryImages.id, image.id));
    }
  });

  await removeUploadedFile(before.imageUrl);
  await writeAudit({
    session: auth.session,
    request,
    action: "homepage_gallery_image.delete",
    entityType: "homepage_gallery_image",
    entityId: id,
    before
  });
  revalidateTag("homepage-gallery", "max");
  return Response.json({ ok: true });
}
