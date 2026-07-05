import { db, houseImages, houses, houseWeekdayPrices } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { normalizeImageUrl } from "@/lib/image-urls";
import { requirePermission } from "@/lib/session";
import { houseSchema, problem } from "@/lib/validation";
import { weekdayPriceRange, weekdayPricesFromRows, weekdays } from "@/lib/weekday-prices";

export async function GET() {
  const auth = await requirePermission("houses.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [rows, priceRows] = await Promise.all([
    db.select({ house: houses, image: houseImages }).from(houses)
      .leftJoin(houseImages, eq(houseImages.houseId, houses.id))
      .orderBy(asc(houses.name), asc(houseImages.position)),
    db.select().from(houseWeekdayPrices)
  ]);
  const items = new Map<string, typeof houses.$inferSelect & {
    images: Array<typeof houseImages.$inferSelect>;
    weekdayPrices: ReturnType<typeof weekdayPricesFromRows>;
    minPrice: number;
    maxPrice: number;
  }>();
  for (const row of rows) {
    const basePrice = Number(row.house.basePrice);
    const weekdayPrices = weekdayPricesFromRows([], basePrice);
    const house = items.get(row.house.id) ?? { ...row.house, images: [], weekdayPrices, ...weekdayPriceRange(weekdayPrices) };
    if (row.image) house.images.push(row.image);
    items.set(row.house.id, house);
  }
  for (const row of priceRows) {
    const house = items.get(row.houseId);
    if (house) {
      house.weekdayPrices[row.weekday] = Number(row.price);
      Object.assign(house, weekdayPriceRange(house.weekdayPrices));
    }
  }
  return Response.json({ items: [...items.values()] });
}

export async function POST(request: Request) {
  const auth = await requirePermission("houses.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = houseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { weekdayPrices, images = [], badgeText, ...data } = parsed.data;
  const minimumPrice = Math.min(...weekdays.map((weekday) => weekdayPrices[weekday]));
  const house = await db.transaction(async (tx) => {
    const [created] = await tx.insert(houses).values({
      ...data,
      badgeText: badgeText?.trim() || null,
      basePrice: String(minimumPrice),
      rules: ""
    }).returning();
    await tx.insert(houseWeekdayPrices).values(weekdays.map((weekday) => ({
      houseId: created.id,
      weekday,
      price: String(weekdayPrices[weekday])
    })));
    if (images.length) {
      await tx.insert(houseImages).values(images.map((image, index) => ({
        houseId: created.id,
        url: normalizeImageUrl(image.url) ?? image.url,
        alt: image.alt,
        position: index,
        isMain: index === 0,
        isActive: true
      })));
    }
    return created;
  });
  await writeAudit({ session: auth.session, request, action: "house.create", entityType: "house", entityId: house.id, after: { ...house, weekdayPrices } });
  revalidateTag("houses", "max");
  return Response.json({ item: { ...house, images, weekdayPrices, minPrice: minimumPrice, maxPrice: Math.max(...weekdays.map((weekday) => weekdayPrices[weekday])) } }, { status: 201 });
}
