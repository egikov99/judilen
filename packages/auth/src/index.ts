import { SignJWT, jwtVerify } from "jose";

export type Role = "client" | "admin" | "content_manager" | "manager";
export type Permission =
  | "dashboard.read"
  | "bookings.read"
  | "bookings.write"
  | "customers.read"
  | "customers.write"
  | "houses.read"
  | "houses.write"
  | "content.write"
  | "reports.read"
  | "users.manage"
  | "integrations.manage"
  | "settings.manage";

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE = "judilen_session";

const rolePermissions: Record<Role, readonly Permission[]> = {
  client: [],
  admin: [
    "dashboard.read",
    "bookings.read",
    "bookings.write",
    "customers.read",
    "customers.write",
    "houses.read",
    "houses.write",
    "content.write",
    "reports.read",
    "users.manage",
    "integrations.manage",
    "settings.manage"
  ],
  content_manager: ["dashboard.read", "houses.read", "houses.write", "content.write"],
  manager: ["dashboard.read", "bookings.read", "bookings.write", "customers.read", "customers.write"]
};

export function can(role: Role, permission: Permission) {
  return rolePermissions[role].includes(permission);
}

function secretKey(secret = process.env.AUTH_SECRET) {
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: Session, secret?: string) {
  const ttl = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24 * 7);
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secretKey(secret));
}

export async function verifySessionToken(token: string, secret?: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      !["client", "admin", "content_manager", "manager"].includes(String(payload.role))
    ) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role as Role
    };
  } catch {
    return null;
  }
}

export function adminNavigation(role: Role) {
  const items = [
    { href: "/admin", label: "Обзор", permission: "dashboard.read" },
    { href: "/admin/bookings", label: "Бронирования", permission: "bookings.read" },
    { href: "/admin/calendar", label: "Шахматка", permission: "bookings.read" },
    { href: "/admin/customers", label: "Клиенты", permission: "customers.read" },
    { href: "/admin/houses", label: "Домики", permission: "houses.read" },
    { href: "/admin/content", label: "Контент", permission: "content.write" },
    { href: "/admin/reports", label: "Отчеты", permission: "reports.read" },
    { href: "/admin/integrations", label: "Интеграции", permission: "integrations.manage" },
    { href: "/admin/users", label: "Пользователи", permission: "users.manage" }
  ] satisfies Array<{ href: string; label: string; permission: Permission }>;
  return items.filter((item) => can(role, item.permission));
}
