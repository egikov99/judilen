import { db, houses, integrations } from "@judilen/db";
import { desc } from "drizzle-orm";
import { IntegrationCreateForm, IntegrationSyncButton } from "@/components/admin/integration-manager";
import { requirePagePermission } from "@/lib/session";

export default async function IntegrationsPage() {
  await requirePagePermission("integrations.manage");
  const [rows, houseRows] = await Promise.all([
    db.select().from(integrations).orderBy(desc(integrations.createdAt)),
    db.select({ id: houses.id, name: houses.name }).from(houses)
  ]);
  return <main className="admin-content"><h1 className="admin-title">Интеграции</h1><p className="admin-subtitle">Синхронизация доступности и импорт внешних бронирований.</p><section className="panel" style={{ marginBottom: 20 }}><h2>Подключить календарь</h2><IntegrationCreateForm houses={houseRows} /></section><section className="panel"><h2>Каналы продаж</h2><table className="data-table"><thead><tr><th>Интеграция</th><th>Тип</th><th>Последняя синхронизация</th><th>Статус</th><th>Действие</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.kind}</td><td>{row.lastSyncedAt?.toLocaleString("ru-RU") ?? "Еще не запускалась"}</td><td><span className={`badge ${row.isEnabled ? "" : "badge-warn"}`}>{row.isEnabled ? "Работает" : "Отключена"}</span></td><td>{row.kind === "ical" && <IntegrationSyncButton id={row.id} />}</td></tr>)}</tbody></table>{!rows.length && <p className="notice">Интеграции пока не подключены.</p>}</section></main>;
}
