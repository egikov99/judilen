import { db, houseImages, houses } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
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
  const parsed = houseImageSchema.required({ url: true, alt: true, position: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [house] = await db.select({ id: houses.id }).from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) return problem(404, "Домик не найден");
  const [image] = await db.transaction(async (tx) => {
    if (parsed.data.isMain) await tx.update(houseImages).set({ isMain: false }).where(eq(houseImages.houseId, id));
    const [created] = await tx.insert(houseImages).values({
      houseId: id,
      url: parsed.data.url,
      alt: parsed.data.alt,
      caption: parsed.data.caption || null,
      position: parsed.data.position,
      isMain: parsed.data.isMain ?? false,
      isActive: parsed.data.isActive ?? true
    }).returning();
    return [created];
  });
  await writeAudit({ session: auth.session, request, action: "house_image.create", entityType: "house_image", entityId: image.id, after: image });
  revalidateTag("houses", "max");
  return Response.json({ item: image }, { status: 201 });
}
