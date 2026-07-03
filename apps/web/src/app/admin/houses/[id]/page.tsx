import { db, houseImages, houses } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { HouseImagesManager } from "@/components/admin/house-images-manager";
import { HouseEditor } from "@/components/admin/house-editor";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePagePermission } from "@/lib/session";

export default async function EditHousePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("houses.update");
  const { id } = await params;
  const [house] = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) notFound();
  const images = await db.select().from(houseImages).where(eq(houseImages.houseId, id)).orderBy(asc(houseImages.position));
  return <main className="admin-content"><h1 className="admin-title">Редактирование</h1><p className="admin-subtitle">{house.name}</p><HouseEditor value={{ ...house, basePrice: String(house.basePrice) }} /><HouseImagesManager houseId={id} images={images.map((image) => ({ ...image, url: normalizeImageUrl(image.url) ?? image.url }))} /></main>;
}
