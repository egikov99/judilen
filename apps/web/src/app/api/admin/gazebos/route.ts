import { db, gazeboImages, gazebos } from "@judilen/db";
import { asc } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { hasDatabaseErrorCode } from "@/lib/booking-availability";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePermission } from "@/lib/session";
import { gazeboSchema, problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("gazebos.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [gazeboRows, imageRows] = await Promise.all([
    db.select().from(gazebos).orderBy(asc(gazebos.sortOrder), asc(gazebos.title)),
    db.select().from(gazeboImages).orderBy(asc(gazeboImages.sortOrder))
  ]);
  return Response.json({ items: gazeboRows.map((gazebo) => ({
    ...gazebo,
    images: imageRows.filter((image) => image.gazeboId === gazebo.id)
  })) });
}

export async function POST(request: Request) {
  const auth = await requirePermission("gazebos.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = gazeboSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { images = [], ...data } = parsed.data;
  let gazebo: typeof gazebos.$inferSelect;
  try {
    [gazebo] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(gazebos).values(data).returning();
      if (images.length) await tx.insert(gazeboImages).values(images.map((image, index) => ({
        gazeboId: created.id,
        url: normalizeImageUrl(image.url) ?? image.url,
        alt: image.alt,
        sortOrder: index
      })));
      return [created];
    });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) return problem(409, "Беседка с таким названием или slug уже существует");
    throw error;
  }
  await writeAudit({ session: auth.session, request, action: "gazebo.create", entityType: "gazebo", entityId: gazebo.id, after: gazebo });
  revalidateTag("gazebos", "max");
  return Response.json({ item: { ...gazebo, images } }, { status: 201 });
}
