import { db, integrations } from "@judilen/db";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const integrationSchema = z.object({
  houseId: z.uuid().nullable(),
  kind: z.enum(["ical", "booking", "airbnb", "ostrovok", "expedia", "google_travel"]),
  name: z.string().trim().min(2).max(120),
  config: z.record(z.string(), z.unknown()),
  isEnabled: z.boolean().default(true)
});

export async function GET() {
  const auth = await requirePermission("integrations.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json({ items: await db.select().from(integrations).orderBy(desc(integrations.createdAt)) });
}

export async function POST(request: Request) {
  const auth = await requirePermission("integrations.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = integrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  if (parsed.data.kind === "ical" && typeof parsed.data.config.url !== "string") return problem(422, "Для iCal требуется config.url");
  const [integration] = await db.insert(integrations).values(parsed.data).returning();
  await writeAudit({ session: auth.session, request, action: "integration.create", entityType: "integration", entityId: integration.id, after: integration });
  return Response.json({ item: integration }, { status: 201 });
}

