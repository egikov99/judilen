import { contentPages, db } from "@judilen/db";
import { asc } from "drizzle-orm";
import { ContentCreateForm } from "@/components/admin/content-create-form";
import { requirePagePermission } from "@/lib/session";

export default async function ContentPage() {
  await requirePagePermission("content.write");
  const rows = await db.select().from(contentPages).orderBy(asc(contentPages.title));
  return <main className="admin-content"><h1 className="admin-title">Контент и SEO</h1><p className="admin-subtitle">Редактируемые страницы, мета-теги и публикация.</p><section className="panel" style={{ marginBottom: 20 }}><h2>Новая страница</h2><ContentCreateForm /></section><section className="panel"><table className="data-table"><thead><tr><th>Страница</th><th>URL</th><th>SEO title</th><th>Статус</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td data-label="Страница"><strong>{row.title}</strong></td><td data-label="URL">/{row.slug}</td><td data-label="SEO title">{row.seoTitle}</td><td data-label="Статус"><span className={`badge ${row.isPublished ? "" : "badge-warn"}`}>{row.isPublished ? "Опубликована" : "Черновик"}</span></td></tr>)}</tbody></table>{!rows.length && <p className="notice">Контентных страниц пока нет.</p>}</section></main>;
}
