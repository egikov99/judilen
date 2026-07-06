import { db, salesChannels } from "@judilen/db";
import { asc } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { salesChannelSchema } from "@/lib/crm-validation";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("sales_channels.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const items = await db.select().from(salesChannels).orderBy(asc(salesChannels.sortOrder), asc(salesChannels.name));
  return Response.json({ items });
}

export async function POST(request: Request) {
  const auth = await requirePermission("sales_channels.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = salesChannelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [item] = await db.insert(salesChannels).values(parsed.data).returning();
  await writeAudit({ session: auth.session, request, action: "sales_channel.create", entityType: "sales_channel", entityId: item.id, after: item });
  return Response.json({ item }, { status: 201 });
}
