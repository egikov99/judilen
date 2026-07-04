import { db, serviceImages } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({ imageIds: z.array(z.uuid()).min(1) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректный порядок", parsed.error.flatten());
  const { id } = await params;
  const rows = await db.select({ id: serviceImages.id }).from(serviceImages).where(eq(serviceImages.serviceId, id));
  const ids = parsed.data.imageIds;
  if (new Set(ids).size !== ids.length || rows.length !== ids.length || rows.some((row) => !ids.includes(row.id))) {
    return problem(422, "Передайте все фотографии услуги без повторов");
  }
  await db.transaction(async (tx) => {
    for (const [index, imageId] of ids.entries()) {
      await tx.update(serviceImages).set({ sortOrder: -(index + 1), updatedAt: new Date() }).where(eq(serviceImages.id, imageId));
    }
    for (const [index, imageId] of ids.entries()) {
      await tx.update(serviceImages).set({ sortOrder: index, updatedAt: new Date() }).where(eq(serviceImages.id, imageId));
    }
  });
  await writeAudit({ session: auth.session, request, action: "service_images.reorder", entityType: "service", entityId: id, after: { imageIds: ids } });
  revalidateTag("services", "max");
  return Response.json({ ok: true });
}
