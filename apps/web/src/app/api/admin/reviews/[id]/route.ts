import { db, reviews } from "@judilen/db";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { adminReviewSchema, problem } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("reviews.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = adminReviewSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  const [before] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!before) return problem(404, "Отзыв не найден");
  const moderation = parsed.data.status
    ? { status: parsed.data.status, isPublished: parsed.data.status === "published" }
    : parsed.data.isPublished === undefined
      ? {}
      : { status: parsed.data.isPublished ? "published" as const : "rejected" as const };
  const [after] = await db.update(reviews).set({ ...parsed.data, ...moderation, updatedAt: new Date() }).where(eq(reviews.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "review.update", entityType: "review", entityId: id, before, after });
  revalidateTag("reviews", "max");
  return Response.json({ item: after });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("reviews.delete");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [before] = await db.select().from(reviews).where(eq(reviews.id, id)).limit(1);
  if (!before) return problem(404, "Отзыв не найден");
  await db.delete(reviews).where(eq(reviews.id, id));
  await writeAudit({ session: auth.session, request, action: "review.delete", entityType: "review", entityId: id, before });
  revalidateTag("reviews", "max");
  return Response.json({ ok: true });
}
