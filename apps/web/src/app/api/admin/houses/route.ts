import { db, houseImages, houses } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { houseSchema, problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("houses.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rows = await db.select({ house: houses, image: houseImages }).from(houses)
    .leftJoin(houseImages, eq(houseImages.houseId, houses.id))
    .orderBy(asc(houses.name), asc(houseImages.position));
  const items = new Map<string, typeof houses.$inferSelect & { images: Array<typeof houseImages.$inferSelect> }>();
  for (const row of rows) {
    const house = items.get(row.house.id) ?? { ...row.house, images: [] };
    if (row.image) house.images.push(row.image);
    items.set(row.house.id, house);
  }
  return Response.json({ items: [...items.values()] });
}

export async function POST(request: Request) {
  const auth = await requirePermission("houses.create");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = houseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [house] = await db.insert(houses).values({
    ...parsed.data,
    basePrice: String(parsed.data.basePrice),
    rules: ""
  }).returning();
  await writeAudit({ session: auth.session, request, action: "house.create", entityType: "house", entityId: house.id, after: house });
  revalidateTag("houses", "max");
  return Response.json({ item: house }, { status: 201 });
}
