import { contentPages, db, homepageGalleryImages } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { ContentCreateForm } from "@/components/admin/content-create-form";
import { HomepageGalleryManager } from "@/components/admin/homepage-gallery-manager";
import { TERRITORY_GALLERY_SECTION } from "@/lib/homepage-gallery";
import { requirePagePermission } from "@/lib/session";

export default async function ContentPage() {
  await requirePagePermission("content.write");
  const [rows, galleryImages] = await Promise.all([
    db.select().from(contentPages).orderBy(asc(contentPages.title)),
    db.select().from(homepageGalleryImages)
      .where(eq(homepageGalleryImages.sectionKey, TERRITORY_GALLERY_SECTION))
      .orderBy(asc(homepageGalleryImages.sortOrder))
  ]);
  return <main className="admin-content"><h1 className="admin-title">Контент и SEO</h1><p className="admin-subtitle">Редактируемые страницы, мета-теги, публикация и галереи главной страницы.</p><HomepageGalleryManager images={galleryImages} /><section className="panel" style={{ marginBottom: 20 }}><h2>Новая страница</h2><ContentCreateForm /></section><section className="panel"><table className="data-table"><thead><tr><th>Страница</th><th>URL</th><th>SEO title</th><th>Статус</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td data-label="Страница"><strong>{row.title}</strong></td><td data-label="URL">/{row.slug}</td><td data-label="SEO title">{row.seoTitle}</td><td data-label="Статус"><span className={`badge ${row.isPublished ? "" : "badge-warn"}`}>{row.isPublished ? "Опубликована" : "Черновик"}</span></td></tr>)}</tbody></table>{!rows.length && <p className="notice">Контентных страниц пока нет.</p>}</section></main>;
}
