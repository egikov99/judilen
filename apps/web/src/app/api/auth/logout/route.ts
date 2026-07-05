import { SESSION_COOKIE } from "@judilen/auth";
import { db, users } from "@judilen/db";
import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (session) {
    await db.update(users).set({
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date()
    }).where(eq(users.id, session.userId));
  }
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}
