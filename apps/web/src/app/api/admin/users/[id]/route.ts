import { db, roles, users } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { writeAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "content_manager", "manager"]).optional()
}).refine((value) => Object.keys(value).length > 0);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("users.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const { id } = await params;
  if (id === auth.session.userId && parsed.data.isActive === false) return problem(409, "Нельзя заблокировать собственный аккаунт");
  const [before] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!before) return problem(404, "Пользователь не найден");
  let roleId: string | undefined;
  if (parsed.data.role) {
    const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, parsed.data.role)).limit(1);
    if (!role) return problem(422, "Роль не найдена");
    roleId = role.id;
  }
  const values = {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    phone: parsed.data.phone,
    isActive: parsed.data.isActive
  };
  const [after] = await db.update(users).set({ ...values, ...(roleId ? { roleId } : {}), updatedAt: new Date() }).where(eq(users.id, id)).returning();
  await writeAudit({ session: auth.session, request, action: "user.update", entityType: "user", entityId: id, before, after });
  return Response.json({ item: after });
}
