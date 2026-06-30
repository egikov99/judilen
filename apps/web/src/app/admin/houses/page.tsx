import { db, houses } from "@judilen/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { HouseActions } from "@/components/admin/house-actions";
import { formatCurrency } from "@/lib/catalog";
import { requirePageAccess } from "@/lib/session";

export default async function AdminHousesPage() {
  const access = await requirePageAccess("houses.read");
  const rows = await db.select().from(houses).orderBy(asc(houses.name));
  const canCreate = access.permissions.includes("houses.create");
  const canUpdate = access.permissions.includes("houses.update");
  const canDelete = access.permissions.includes("houses.delete");
  return <main className="admin-content"><h1 className="admin-title">Управление каталогом</h1><p className="admin-subtitle">Публикация, цены, фотографии и SEO-поля домиков.</p><section className="panel">{canCreate && <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}><Link className="button button-primary" href="/admin/houses/new">+ Добавить домик</Link></div>}<table className="data-table"><thead><tr><th>Дом</th><th>Вместимость</th><th>Базовая цена</th><th>Публикация</th>{(canUpdate || canDelete) && <th>Действие</th>}</tr></thead><tbody>{rows.map((house) => <tr key={house.id}><td><strong>{house.name}</strong><br /><small>/{house.slug}</small></td><td>{house.guests} гостей · {house.rooms} комн.</td><td>{formatCurrency(Number(house.basePrice))}</td><td><span className={`badge ${house.isPublished ? "" : "badge-warn"}`}>{house.isPublished ? "Опубликован" : "Скрыт"}</span></td>{(canUpdate || canDelete) && <td><HouseActions id={house.id} canUpdate={canUpdate} canDelete={canDelete} /></td>}</tr>)}</tbody></table></section></main>;
}
