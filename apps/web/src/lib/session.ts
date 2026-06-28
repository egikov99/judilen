import { SESSION_COOKIE, verifySessionToken, type Permission, can } from "@judilen/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await getSession();
  if (!session) return { error: "unauthorized" as const, session: null };
  if (!can(session.role, permission)) return { error: "forbidden" as const, session };
  return { error: null, session };
}

export async function requirePagePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.role, permission)) redirect("/admin?forbidden=1");
  return session;
}
