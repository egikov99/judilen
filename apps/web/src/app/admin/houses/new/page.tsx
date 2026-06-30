import { HouseEditor } from "@/components/admin/house-editor";
import { requirePagePermission } from "@/lib/session";
export default async function NewHousePage() {
  await requirePagePermission("houses.create");
  return <main className="admin-content"><h1 className="admin-title">Новый домик</h1><p className="admin-subtitle">Заполните контент, цену и SEO-поля.</p><HouseEditor /></main>;
}
