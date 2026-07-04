import { db, houses, houseWeekdayPrices } from "@judilen/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { HouseActions } from "@/components/admin/house-actions";
import { formatCurrency } from "@/components/currency";
import { requirePageAccess } from "@/lib/session";
import { weekdayPriceRange, weekdayPricesFromRows } from "@/lib/weekday-prices";

export default async function AdminHousesPage() {
  const access = await requirePageAccess("houses.read");
  const [rows, priceRows] = await Promise.all([
    db.select().from(houses).orderBy(asc(houses.name)),
    db.select().from(houseWeekdayPrices)
  ]);
  const pricesByHouse = new Map<string, typeof priceRows>();
  for (const price of priceRows) pricesByHouse.set(price.houseId, [...(pricesByHouse.get(price.houseId) ?? []), price]);
  const canCreate = access.permissions.includes("houses.create");
  const canUpdate = access.permissions.includes("houses.update");
  const canDelete = access.permissions.includes("houses.delete");
  return <main className="admin-content"><h1 className="admin-title">Управление каталогом</h1><p className="admin-subtitle">Публикация, цены, фотографии и SEO-поля домиков.</p><section className="panel">{canCreate && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}><Link className="button button-primary" href="/admin/houses/new">+ Добавить домик</Link></div>}<table className="data-table"><thead><tr><th>Дом</th><th>Вместимость</th><th>Цена за ночь</th><th>Публикация</th>{(canUpdate || canDelete) && <th>Действие</th>}</tr></thead><tbody>{rows.map((house) => { const range = weekdayPriceRange(weekdayPricesFromRows(pricesByHouse.get(house.id) ?? [], Number(house.basePrice))); return <tr key={house.id}><td data-label="Дом"><strong>{house.name}</strong><br /><small>/{house.slug}</small></td><td data-label="Вместимость">{house.guests} гостей · {house.rooms} комн.</td><td data-label="Цена за ночь">{formatCurrency(range.minPrice)}{range.minPrice !== range.maxPrice && <> — {formatCurrency(range.maxPrice)}</>}</td><td data-label="Публикация"><span className={`badge ${house.isPublished ? "" : "badge-warn"}`}>{house.isPublished ? "Опубликован" : "Скрыт"}</span></td>{(canUpdate || canDelete) && <td data-label=""><HouseActions id={house.id} canUpdate={canUpdate} canDelete={canDelete} /></td>}</tr>; })}</tbody></table></section></main>;
}
