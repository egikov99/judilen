import { db, homepageGalleryImages } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { TERRITORY_GALLERY_SECTION } from "@/lib/homepage-gallery";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({
  sectionKey: z.string().regex(/^[a-z0-9-]+$/i).default(TERRITORY_GALLERY_SECTION),
  imageIds: z.array(z.uuid()).min(1)
});

export async function POST(request: Request) {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный порядок", parsed.error.flatten());

  const rows = await db
    .select({ id: homepageGalleryImages.id })
    .from(homepageGalleryImages)
    .where(eq(homepageGalleryImages.sectionKey, parsed.data.sectionKey));
  const ids = parsed.data.imageIds;
  if (new Set(ids).size !== ids.length || rows.length !== ids.length || rows.some((row) => !ids.includes(row.id))) {
    return problem(422, "Передайте все фотографии раздела без повторов");
  }

  await db.transaction(async (tx) => {
    for (const [index, imageId] of ids.entries()) {
      await tx
        .update(homepageGalleryImages)
        .set({ sortOrder: -(index + 1), updatedAt: new Date() })
        .where(eq(homepageGalleryImages.id, imageId));
    }
    for (const [index, imageId] of ids.entries()) {
      await tx
        .update(homepageGalleryImages)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(homepageGalleryImages.id, imageId));
    }
  });

  await writeAudit({
    session: auth.session,
    request,
    action: "homepage_gallery.reorder",
    entityType: "homepage_gallery",
    entityId: parsed.data.sectionKey,
    after: { imageIds: ids }
  });
  revalidateTag("homepage-gallery", "max");
  return Response.json({ ok: true });
}
