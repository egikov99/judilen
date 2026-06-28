import { contentPages, db } from "@judilen/db";
import { asc } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export const contentSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  title: z.string().trim().min(2).max(160),
  content: z.record(z.string(), z.unknown()),
  seoTitle: z.string().trim().min(10).max(70),
  seoDescription: z.string().trim().min(30).max(180),
  isPublished: z.boolean()
});

export async function GET() {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  return Response.json({ items: await db.select().from(contentPages).orderBy(asc(contentPages.title)) });
}

export async function POST(request: Request) {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = contentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [page] = await db.insert(contentPages).values(parsed.data).returning();
  await writeAudit({ session: auth.session, request, action: "content.create", entityType: "content_page", entityId: page.id, after: page });
  return Response.json({ item: page }, { status: 201 });
}

