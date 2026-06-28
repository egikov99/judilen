import { SESSION_COOKIE } from "@judilen/auth";
import { cookies } from "next/headers";

export async function POST() {
  (await cookies()).set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return Response.json({ ok: true });
}

