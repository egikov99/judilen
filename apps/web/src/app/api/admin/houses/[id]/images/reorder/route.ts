import { db, houseImages } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({ imageIds: z.array(z.uuid()).min(1).max(100) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("house_images.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный порядок", parsed.error.flatten());
  const { id } = await params;
  const rows = await db.select({ id: houseImages.id }).from(houseImages).where(eq(houseImages.houseId, id));
  if (rows.length !== parsed.data.imageIds.length || rows.some((row) => !parsed.data.imageIds.includes(row.id))) return problem(422, "Передайте все фотографии домика без повторов");
  await db.transaction(async (tx) => {
    for (const [index, imageId] of parsed.data.imageIds.entries()) {
      await tx.update(houseImages).set({ position: -(index + 1), updatedAt: new Date() }).where(eq(houseImages.id, imageId));
    }
    for (const [index, imageId] of parsed.data.imageIds.entries()) {
      await tx.update(houseImages).set({ position: index, updatedAt: new Date() }).where(eq(houseImages.id, imageId));
    }
  });
  return Response.json({ ok: true });
}
