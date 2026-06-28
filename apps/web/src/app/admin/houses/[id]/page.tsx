import { db, houses } from "@judilen/db";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { HouseEditor } from "@/components/admin/house-editor";
import { requirePagePermission } from "@/lib/session";

export default async function EditHousePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("houses.write");
  const { id } = await params;
  const [house] = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) notFound();
  return <main className="admin-content"><h1 className="admin-title">Редактирование</h1><p className="admin-subtitle">{house.name}</p><HouseEditor value={{ ...house, basePrice: String(house.basePrice) }} /></main>;
}
