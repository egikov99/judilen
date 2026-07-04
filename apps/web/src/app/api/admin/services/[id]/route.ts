import { db, serviceHouses, serviceImages, serviceOptions, services } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePermission } from "@/lib/session";
import { removeUploadedFile } from "@/lib/uploads";
import { problem, serviceSchema } from "@/lib/validation";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [service] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!service) return problem(404, "Услуга не найдена");
  const [options, houses, images] = await Promise.all([
    db.select().from(serviceOptions).where(eq(serviceOptions.serviceId, id)),
    db.select().from(serviceHouses).where(eq(serviceHouses.serviceId, id)),
    db.select().from(serviceImages).where(eq(serviceImages.serviceId, id)).orderBy(asc(serviceImages.sortOrder))
  ]);
  return Response.json({ item: { ...service, images }, options, houseIds: houses.map((item) => item.houseId) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!before) return problem(404, "Услуга не найдена");
  const { houseIds, basePrice, images: submittedImages, ...data } = parsed.data;
  const previousImages = submittedImages
    ? await db.select().from(serviceImages).where(eq(serviceImages.serviceId, id))
    : [];
  const normalizedImages = submittedImages?.map((image, index) => ({
    ...image,
    url: normalizeImageUrl(image.url) ?? image.url,
    sortOrder: index
  }));
  const [after] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(services).set({
      ...data,
      ...(basePrice === undefined ? {} : { basePrice: String(basePrice) }),
      updatedAt: new Date()
    }).where(eq(services.id, id)).returning();
    if (houseIds) {
      await tx.delete(serviceHouses).where(eq(serviceHouses.serviceId, id));
      if (houseIds.length) await tx.insert(serviceHouses).values(houseIds.map((houseId) => ({ serviceId: id, houseId })));
    }
    if (normalizedImages) {
      await tx.delete(serviceImages).where(eq(serviceImages.serviceId, id));
      if (normalizedImages.length) await tx.insert(serviceImages).values(normalizedImages.map((image, index) => ({
        serviceId: id,
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
  await writeAudit({ session: auth.session, request, action: "service.update", entityType: "service", entityId: id, before, after });
  revalidateTag("services", "max");
  return Response.json({ item: { ...after, ...(normalizedImages ? { images: normalizedImages } : {}) } });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("services.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(services).where(eq(services.id, id)).limit(1);
  if (!before) return problem(404, "Услуга не найдена");
  const images = await db.select().from(serviceImages).where(eq(serviceImages.serviceId, id));
  await db.delete(services).where(eq(services.id, id));
  await Promise.all(images.map((image) => removeUploadedFile(image.url)));
  await writeAudit({ session: auth.session, request, action: "service.delete", entityType: "service", entityId: id, before });
  revalidateTag("services", "max");
  return Response.json({ ok: true });
}
