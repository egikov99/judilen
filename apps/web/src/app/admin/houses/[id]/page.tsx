import { db, houseImages, houses, houseWeekdayPrices } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { HouseImagesManager } from "@/components/admin/house-images-manager";
import { HouseEditor } from "@/components/admin/house-editor";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePagePermission } from "@/lib/session";
import { weekdayPricesFromRows } from "@/lib/weekday-prices";

export default async function EditHousePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("houses.update");
  const { id } = await params;
  const [house] = await db.select().from(houses).where(eq(houses.id, id)).limit(1);
  if (!house) notFound();
  const [images, priceRows] = await Promise.all([
    db.select().from(houseImages).where(eq(houseImages.houseId, id)).orderBy(asc(houseImages.position)),
    db.select().from(houseWeekdayPrices).where(eq(houseWeekdayPrices.houseId, id))
  ]);
  const weekdayPrices = weekdayPricesFromRows(priceRows, Number(house.basePrice));
  return <main className="admin-content"><h1 className="admin-title">Редактирование</h1><p className="admin-subtitle">{house.name}</p><HouseEditor value={{ ...house, basePrice: String(house.basePrice), weekdayPrices }} /><HouseImagesManager houseId={id} images={images.map((image) => ({ ...image, url: normalizeImageUrl(image.url) ?? image.url }))} /></main>;
}
