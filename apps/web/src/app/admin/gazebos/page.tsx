import { db, gazeboImages, gazebos } from "@judilen/db";
import { asc } from "drizzle-orm";
import { GazeboManager } from "@/components/admin/gazebo-manager";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePageAccess } from "@/lib/session";

export default async function AdminGazebosPage() {
  const access = await requirePageAccess("gazebos.read");
  const [gazeboRows, imageRows] = await Promise.all([
    db.select().from(gazebos).orderBy(asc(gazebos.sortOrder), asc(gazebos.title)),
    db.select().from(gazeboImages).orderBy(asc(gazeboImages.sortOrder))
  ]);
  return <main className="admin-content"><h1 className="admin-title">Беседки</h1><p className="admin-subtitle">Информационный раздел без цен, календаря и бронирований.</p><GazeboManager gazebos={gazeboRows.map((item) => ({ ...item, images: imageRows.filter((image) => image.gazeboId === item.id).map((image) => ({ ...image, url: normalizeImageUrl(image.url) ?? image.url })) }))} permissions={access.permissions} /></main>;
}
