import { customers, db, users } from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { problem } from "@/lib/validation";

const schema = z.object({
  firstName: z.string().trim().min(2).max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  phone: z.string().trim().min(7).max(30).optional()
}).refine((value) => Object.keys(value).length > 0);

export async function GET() {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const [profile] = await db.select({
    email: users.email,
    firstName: users.firstName,
    lastName: users.lastName,
    phone: users.phone
  }).from(users).where(eq(users.id, session.userId)).limit(1);
  return profile ? Response.json({ item: profile }) : problem(404, "Профиль не найден");
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return problem(401, "Требуется авторизация");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [profile] = await db.transaction(async (tx) => {
    const [updated] = await tx.update(users).set({ ...parsed.data, updatedAt: new Date() }).where(eq(users.id, session.userId)).returning({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone
    });
    await tx.update(customers).set({ ...parsed.data, updatedAt: new Date() }).where(eq(customers.userId, session.userId));
    return [updated];
  });
  return Response.json({ item: profile });
}

