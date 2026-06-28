import { contentPages, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { contentSchema } from "../route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("content.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = contentSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(contentPages).where(eq(contentPages.id, id)).limit(1);
  if (!before) return problem(404, "Страница не найдена");
  const [after] = await db.update(contentPages).set({ ...parsed.data, updatedAt: new Date() }).where(eq(contentPages.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "content.update", entityType: "content_page", entityId: id, before, after });
  return Response.json({ item: after });
}
