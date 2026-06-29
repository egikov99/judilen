import { db, houses, serviceHouses, serviceOptions, services } from "@judilen/db";
import { asc } from "drizzle-orm";
import { ServiceManager } from "@/components/admin/service-manager";
import { requirePagePermission } from "@/lib/session";

export default async function AdminServicesPage() {
  await requirePagePermission("services.read");
  const [serviceRows, optionRows, houseRows, links] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(serviceOptions).orderBy(asc(serviceOptions.sortOrder)),
    db.select({ id: houses.id, name: houses.name }).from(houses).orderBy(asc(houses.name)),
    db.select().from(serviceHouses)
  ]);
  const serviceHouseIds = links.reduce<Record<string, string[]>>((acc, link) => {
    acc[link.serviceId] = [...(acc[link.serviceId] ?? []), link.houseId];
    return acc;
  }, {});
  return <main className="admin-content"><h1 className="admin-title">Услуги</h1><p className="admin-subtitle">Управление услугами, ценами, вариантами и привязкой к домикам.</p><ServiceManager services={serviceRows.map((item) => ({ ...item, basePrice: String(item.basePrice) }))} options={optionRows.map((item) => ({ ...item, price: String(item.price) }))} houses={houseRows} serviceHouseIds={serviceHouseIds} /></main>;
}
