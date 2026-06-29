import { db, houses } from "@judilen/db";
import { asc } from "drizzle-orm";
import Link from "next/link";
import { HouseActions } from "@/components/admin/house-actions";
import { formatCurrency } from "@/lib/catalog";
import { requirePagePermission } from "@/lib/session";

export default async function AdminHousesPage() {
  await requirePagePermission("houses.read");
  const rows = await db.select().from(houses).orderBy(asc(houses.name));
  return <main className="admin-content"><h1 className="admin-title">Управление каталогом</h1><p className="admin-subtitle">Публикация, цены, фотографии и SEO-поля домиков.</p><section className="panel"><div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}><Link className="button button-primary" href="/admin/houses/new">+ Добавить домик</Link></div><table className="data-table"><thead><tr><th>Дом</th><th>Вместимость</th><th>Базовая цена</th><th>Публикация</th><th>Действие</th></tr></thead><tbody>{rows.map((house) => <tr key={house.id}><td><strong>{house.name}</strong><br /><small>/{house.slug}</small></td><td>{house.guests} гостей · {house.rooms} комн.</td><td>{formatCurrency(Number(house.basePrice))}</td><td><span className={`badge ${house.isPublished ? "" : "badge-warn"}`}>{house.isPublished ? "Опубликован" : "Скрыт"}</span></td><td><HouseActions id={house.id} /></td></tr>)}</tbody></table></section></main>;
}
