import { db, serviceHouses, serviceImages, serviceOptions, services } from "@judilen/db";
import { asc } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { hasDatabaseErrorCode } from "@/lib/booking-availability";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePermission } from "@/lib/session";
import { problem, serviceSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("services.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [serviceRows, optionRows, houseRows, imageRows] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(serviceOptions).orderBy(asc(serviceOptions.sortOrder)),
    db.select().from(serviceHouses),
    db.select().from(serviceImages).orderBy(asc(serviceImages.sortOrder))
  ]);
  return Response.json({ items: serviceRows.map((service) => ({
    ...service,
    options: optionRows.filter((option) => option.serviceId === service.id),
    houseIds: houseRows.filter((link) => link.serviceId === service.id).map((link) => link.houseId),
    images: imageRows.filter((image) => image.serviceId === service.id)
  })) });
}

export async function POST(request: Request) {
  const auth = await requirePermission("services.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = serviceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { houseIds, basePrice, images = [], ...data } = parsed.data;
  let service: typeof services.$inferSelect;
  try {
    [service] = await db.transaction(async (tx) => {
      const [created] = await tx.insert(services).values({
        ...data,
        basePrice: String(basePrice)
      }).returning();
      if (houseIds.length) await tx.insert(serviceHouses).values(houseIds.map((houseId) => ({ serviceId: created.id, houseId })));
      if (images.length) await tx.insert(serviceImages).values(images.map((image, index) => ({
        serviceId: created.id,
        url: normalizeImageUrl(image.url) ?? image.url,
        alt: image.alt,
        sortOrder: index
      })));
      return [created];
    });
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) return problem(409, "Услуга с таким названием или slug уже существует");
    throw error;
  }
  await writeAudit({ session: auth.session, request, action: "service.create", entityType: "service", entityId: service.id, after: service });
  revalidateTag("services", "max");
  return Response.json({ item: { ...service, images } }, { status: 201 });
}
