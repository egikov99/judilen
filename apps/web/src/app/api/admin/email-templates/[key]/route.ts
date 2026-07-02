import { db, emailTemplates } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email-templates";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({
  subject: z.string().trim().min(1).max(300),
  htmlContent: z.string().trim().min(1).max(100_000),
  textContent: z.string().trim().min(1).max(50_000)
});

function template(key: string) {
  return DEFAULT_EMAIL_TEMPLATES[key as EmailTemplateKey];
}

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { key } = await params;
  const defaults = template(key);
  if (!defaults) return problem(404, "Шаблон не найден");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте содержимое шаблона", parsed.error.flatten());
  const [saved] = await db.insert(emailTemplates).values({
    key, name: defaults.name, ...parsed.data
  }).onConflictDoUpdate({
    target: emailTemplates.key,
    set: { ...parsed.data, updatedAt: new Date() }
  }).returning();
  return Response.json({ item: saved });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { key } = await params;
  const defaults = template(key);
  if (!defaults) return problem(404, "Шаблон не найден");
  await db.delete(emailTemplates).where(eq(emailTemplates.key, key));
  return Response.json({ item: defaults });
}
