import { db, houseImages, houses } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { houseImageSchema, problem } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("house_images.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  return Response.json({ items: await db.select().from(houseImages).where(eq(houseImages.houseId, id)).orderBy(asc(houseImages.position)) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("house_images.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const singleSchema = houseImageSchema.required({ url: true, alt: true, position: true });
  const parsed = z.union([singleSchema, z.array(singleSchema).min(1)]).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const input = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  if (new Set(input.map((image) => image.position)).size !== input.length) return problem(422, "Позиции фотографий не должны повторяться");
  if (input.filter((image) => image.isMain).length > 1) return problem(422, "Главной может быть только одна фотография");
  const images = await db.transaction(async (tx) => {
    if (input.some((image) => image.isMain)) await tx.update(houseImages).set({ isMain: false }).where(eq(houseImages.houseId, id));
    return tx.insert(houseImages).values(input.map((image) => ({
      houseId: id,
      url: image.url,
      alt: image.alt,
      caption: image.caption || null,
      position: image.position,
      isMain: image.isMain ?? false,
      isActive: image.isActive ?? true
    }))).returning();
  });
  for (const image of images) {
    await writeAudit({ session: auth.session, request, action: "house_image.create", entityType: "house_image", entityId: image.id, after: image });
  }
  revalidateTag("houses", "max");
  return Response.json(Array.isArray(parsed.data) ? { items: images } : { item: images[0] }, { status: 201 });
}
