import { hash } from "@node-rs/argon2";
import { createSessionToken, SESSION_COOKIE } from "@judilen/auth";
import { customers, db, roles, users } from "@judilen/db";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { problem } from "@/lib/validation";

const registrationSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase().trim()),
  password: z.string().min(10).max(128).regex(/[a-zа-я]/i).regex(/[0-9]/),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().max(80).default(""),
  phone: z.string().trim().min(7).max(30),
  consent: z.literal(true)
});

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Некорректные данные", parsed.error.flatten());
  const [clientRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "client")).limit(1);
  if (!clientRole) return problem(503, "Сервис регистрации временно недоступен");
  try {
    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({
        email: parsed.data.email,
        passwordHash: await hash(parsed.data.password),
        roleId: clientRole.id,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone
      }).returning();
      await tx.insert(customers).values({
        userId: created.id,
        email: created.email,
        firstName: created.firstName,
        lastName: created.lastName,
        phone: parsed.data.phone
      }).onConflictDoUpdate({
        target: customers.email,
        set: {
          userId: created.id,
          firstName: created.firstName,
          lastName: created.lastName,
          phone: parsed.data.phone,
          updatedAt: new Date()
        }
      });
      return created;
    });
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: "client",
      sessionVersion: 0
    });
    (await cookies()).set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 604800)
    });
    return Response.json({ user: { id: user.id, email: user.email, role: "client" } }, { status: 201 });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code === "23505") return problem(409, "Пользователь с таким email уже существует");
    throw error;
  }
}
