import { db, houses } from "@judilen/db";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { houseSchema, problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("houses.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json({ items: await db.select().from(houses) });
}

export async function POST(request: Request) {
  const auth = await requirePermission("houses.write");
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

