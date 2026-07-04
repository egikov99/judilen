import { db, houses, serviceHouses, serviceImages, serviceOptions, services } from "@judilen/db";
import { asc } from "drizzle-orm";
import { ServiceManager } from "@/components/admin/service-manager";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePageAccess } from "@/lib/session";

export default async function AdminServicesPage() {
  const access = await requirePageAccess("services.read");
  const [serviceRows, optionRows, imageRows, houseRows, links] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(serviceOptions).orderBy(asc(serviceOptions.sortOrder)),
    db.select().from(serviceImages).orderBy(asc(serviceImages.sortOrder)),
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select().from(serviceHouses)
  ]);
  const serviceHouseIds = links.reduce<Record<string, string[]>>((acc, link) => {
    acc[link.serviceId] = [...(acc[link.serviceId] ?? []), link.houseId];
    return acc;
  }, {});
  return <main className="admin-content"><h1 className="admin-title">Услуги</h1><p className="admin-subtitle">Управление услугами, ценами, фотографиями, вариантами и привязкой к домикам.</p><ServiceManager services={serviceRows.map((item) => ({ ...item, images: imageRows.filter((image) => image.serviceId === item.id).map((image) => ({ ...image, url: normalizeImageUrl(image.url) ?? image.url })), basePrice: String(item.basePrice) }))} options={optionRows.map((item) => ({ ...item, price: String(item.price) }))} houses={houseRows} serviceHouseIds={serviceHouseIds} permissions={access.permissions} /></main>;
}
