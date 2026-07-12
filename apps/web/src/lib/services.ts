import { db, serviceHouses, serviceImages, serviceOptions, services } from "@judilen/db";
import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type { PublicService } from "./service-types";
import { normalizeImageUrl } from "./image-urls";
export { priceUnitLabels } from "./service-types";

function mapRows(
  rows: Array<{ service: typeof services.$inferSelect; option: typeof serviceOptions.$inferSelect | null; houseId: string | null }>,
  imageRows: Array<typeof serviceImages.$inferSelect>
) {
  const mapped = new Map<string, PublicService>();
  const optionIds = new Set<string>();
  for (const row of rows) {
    const current = mapped.get(row.service.id) ?? {
      id: row.service.id,
      title: row.service.title,
      slug: row.service.slug,
      description: row.service.description,
      images: [],
      basePrice: Number(row.service.basePrice),
      minRentalHours: row.service.minRentalHours,
      extensionPrice: row.service.extensionPrice === null ? null : Number(row.service.extensionPrice),
      priceUnit: row.service.priceUnit,
      sortOrder: row.service.sortOrder,
      houseIds: [],
      options: []
    };
    if (row.houseId && !current.houseIds.includes(row.houseId)) current.houseIds.push(row.houseId);
    if (row.option && !optionIds.has(row.option.id)) {
      optionIds.add(row.option.id);
      current.options.push({
        id: row.option.id,
        title: row.option.title,
        description: row.option.description,
        price: Number(row.option.price),
        isDefault: row.option.isDefault,
        sortOrder: row.option.sortOrder
      });
    }
    mapped.set(row.service.id, current);
  }
  for (const image of imageRows) {
    const service = mapped.get(image.serviceId);
    if (!service) continue;
    const imageUrl = normalizeImageUrl(image.url);
    if (imageUrl) service.images.push(imageUrl);
    else console.error("Service image has an invalid URL", { serviceId: image.serviceId, imageId: image.id, url: image.url });
  }
  return [...mapped.values()].map((service) => ({
    ...service,
    options: service.options.sort((a, b) => a.sortOrder - b.sortOrder)
  }));
}

async function loadPublicServices() {
  const [rows, imageRows] = await Promise.all([
    db.select({ service: services, option: serviceOptions, houseId: serviceHouses.houseId })
      .from(services)
      .leftJoin(serviceOptions, and(eq(serviceOptions.serviceId, services.id), eq(serviceOptions.isActive, true)))
      .leftJoin(serviceHouses, eq(serviceHouses.serviceId, services.id))
      .where(eq(services.isActive, true))
      .orderBy(asc(services.sortOrder), asc(serviceOptions.sortOrder)),
    db.select().from(serviceImages).orderBy(asc(serviceImages.sortOrder))
  ]);
  return mapRows(rows, imageRows);
}

export const getPublicServices = unstable_cache(loadPublicServices, ["public-services"], {
  revalidate: 300,
  tags: ["services"]
});

export async function getPublicServicesForHouse(houseId: string) {
  return (await getPublicServices()).filter((service) => !service.houseIds.length || service.houseIds.includes(houseId));
}

export async function getPublicServiceBySlug(slug: string) {
  return (await getPublicServices()).find((service) => service.slug === slug);
}

export async function getActiveServicesByIds(serviceIds: string[], houseId: string) {
  if (!serviceIds.length) return [];
  const [rows, imageRows] = await Promise.all([
    db.select({ service: services, option: serviceOptions, houseId: serviceHouses.houseId })
      .from(services)
      .leftJoin(serviceOptions, and(eq(serviceOptions.serviceId, services.id), eq(serviceOptions.isActive, true)))
      .leftJoin(serviceHouses, eq(serviceHouses.serviceId, services.id))
      .where(and(
        eq(services.isActive, true),
        inArray(services.id, serviceIds),
        or(eq(serviceHouses.houseId, houseId), sql`${serviceHouses.houseId} is null`)
      ))
      .orderBy(asc(services.sortOrder), asc(serviceOptions.sortOrder)),
    db.select().from(serviceImages).where(inArray(serviceImages.serviceId, serviceIds)).orderBy(asc(serviceImages.sortOrder))
  ]);
  return mapRows(rows, imageRows);
}
