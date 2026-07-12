import { SignJWT, jwtVerify } from "jose";

export type Role = "client" | "super_admin" | "admin" | "content_manager" | "manager" | "viewer";
export type Permission =
  | "dashboard.read"
  | "bookings.read"
  | "bookings.write"
  | "bookings.create"
  | "bookings.update"
  | "bookings.delete"
  | "calendar.read"
  | "customers.read"
  | "customers.write"
  | "houses.read"
  | "houses.write"
  | "houses.create"
  | "houses.update"
  | "houses.delete"
  | "services.read"
  | "services.create"
  | "services.update"
  | "services.delete"
  | "gazebos.read"
  | "gazebos.create"
  | "gazebos.update"
  | "gazebos.delete"
  | "service_options.read"
  | "service_options.create"
  | "service_options.update"
  | "service_options.delete"
  | "reviews.read"
  | "reviews.create"
  | "reviews.update"
  | "reviews.delete"
  | "house_images.read"
  | "house_images.create"
  | "house_images.update"
  | "house_images.delete"
  | "uploads.create"
  | "content.write"
  | "reports.read"
  | "users.manage"
  | "users.read"
  | "users.create"
  | "users.update"
  | "users.delete"
  | "users.reset_password"
  | "integrations.manage"
  | "integrations.read"
  | "integrations.create"
  | "integrations.update"
  | "integrations.delete"
  | "external_calendars.read"
  | "external_calendars.create"
  | "external_calendars.update"
  | "external_calendars.delete"
  | "external_calendars.sync"
  | "calendar_conflicts.read"
  | "calendar_conflicts.update"
  | "chats.read"
  | "chats.write"
  | "sales_channels.manage"
  | "expense_categories.manage"
  | "expenses.read"
  | "expenses.write"
  | "client_notes.read"
  | "client_notes.write"
  | "exports.read"
  | "settings.manage";

export interface Session {
  userId: string;
  email: string;
  name: string;
  role: Role;
  sessionVersion: number;
}

export const SESSION_COOKIE = process.env.NODE_ENV === "production"
  ? "__Host-judilen_session"
  : "judilen_session";

const rolePermissions: Record<Role, readonly Permission[]> = {
  client: [],
  super_admin: [
    "dashboard.read", "bookings.read", "bookings.write", "bookings.create", "bookings.update", "bookings.delete", "calendar.read", "customers.read", "customers.write",
    "houses.read", "houses.write", "houses.create", "houses.update", "houses.delete", "services.read", "services.create", "services.update", "services.delete", "gazebos.read", "gazebos.create", "gazebos.update", "gazebos.delete", "service_options.read", "service_options.create", "service_options.update", "service_options.delete",
    "reviews.read", "reviews.create", "reviews.update", "reviews.delete", "house_images.read",
    "house_images.create", "house_images.update", "house_images.delete", "uploads.create", "content.write",
    "reports.read", "users.manage", "users.read", "users.create", "users.update", "users.delete",
    "users.reset_password", "integrations.manage", "integrations.read", "integrations.create",
    "integrations.update", "integrations.delete", "external_calendars.read", "external_calendars.create",
    "external_calendars.update", "external_calendars.delete", "external_calendars.sync",
    "calendar_conflicts.read", "calendar_conflicts.update", "chats.read", "chats.write",
    "sales_channels.manage", "expense_categories.manage", "expenses.read", "expenses.write",
    "client_notes.read", "client_notes.write", "exports.read", "settings.manage"
  ],
  admin: [
    "dashboard.read",
    "bookings.read",
    "bookings.write",
    "bookings.create",
    "bookings.update",
    "bookings.delete",
    "calendar.read",
    "customers.read",
    "customers.write",
    "houses.read",
    "houses.write",
    "houses.create",
    "houses.update",
    "houses.delete",
    "services.read",
    "services.create",
    "services.update",
    "services.delete",
    "gazebos.read",
    "gazebos.create",
    "gazebos.update",
    "gazebos.delete",
    "service_options.read",
    "service_options.create",
    "service_options.update",
    "service_options.delete",
    "reviews.read",
    "reviews.create",
    "reviews.update",
    "reviews.delete",
    "house_images.read",
    "house_images.create",
    "house_images.update",
    "house_images.delete",
    "uploads.create",
    "content.write",
    "reports.read",
    "integrations.read",
    "integrations.create",
    "integrations.update",
    "external_calendars.read",
    "external_calendars.create",
    "external_calendars.update",
    "external_calendars.sync",
    "calendar_conflicts.read",
    "calendar_conflicts.update",
    "chats.read",
    "chats.write",
    "sales_channels.manage",
    "expense_categories.manage",
    "expenses.read",
    "expenses.write",
    "client_notes.read",
    "client_notes.write",
    "exports.read",
    "settings.manage"
  ],
  content_manager: [
    "dashboard.read",
    "houses.read",
    "houses.write",
    "houses.create",
    "houses.update",
    "house_images.read",
    "house_images.create",
    "house_images.update",
    "house_images.delete",
    "uploads.create",
    "services.read",
    "services.create",
    "services.update",
    "gazebos.read",
    "gazebos.create",
    "gazebos.update",
    "service_options.read",
    "service_options.create",
    "service_options.update",
    "reviews.read",
    "reviews.create",
    "reviews.update",
    "content.write"
  ],
  manager: ["dashboard.read", "bookings.read", "bookings.write", "bookings.create", "bookings.update", "calendar.read", "customers.read", "customers.write", "chats.read", "chats.write", "expenses.read", "expenses.write", "client_notes.read", "client_notes.write", "exports.read"],
  viewer: ["dashboard.read", "bookings.read", "calendar.read", "customers.read", "houses.read", "services.read", "gazebos.read", "reviews.read", "house_images.read", "reports.read", "integrations.read", "external_calendars.read", "calendar_conflicts.read", "chats.read", "expenses.read", "client_notes.read", "exports.read"]
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
      !["client", "super_admin", "admin", "content_manager", "manager", "viewer"].includes(String(payload.role))
    ) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role as Role,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 0
    };
  } catch {
    return null;
  }
}

export function adminNavigation(role: Role) {
  const items = [
    { href: "/admin", label: "Обзор", permission: "dashboard.read" },
    { href: "/admin/bookings", label: "Бронирования", permission: "bookings.read" },
    { href: "/admin/calendar", label: "Календарь", permission: "calendar.read" },
    { href: "/admin/chats", label: "Чаты", permission: "chats.read" },
    { href: "/admin/customers", label: "Клиенты", permission: "customers.read" },
    { href: "/admin/expenses", label: "Расходы", permission: "expenses.read" },
    { href: "/admin/houses", label: "Домики", permission: "houses.read" },
    { href: "/admin/services", label: "Услуги", permission: "services.read" },
    { href: "/admin/gazebos", label: "Беседки", permission: "gazebos.read" },
    { href: "/admin/reviews", label: "Отзывы", permission: "reviews.read" },
    { href: "/admin/content", label: "Контент", permission: "content.write" },
    { href: "/admin/reports", label: "Отчеты", permission: "reports.read" },
    { href: "/admin/integrations", label: "Интеграции", permission: "external_calendars.read" },
    { href: "/admin/users", label: "Пользователи", permission: "users.read" },
    { href: "/admin/settings", label: "Настройки", permission: "settings.manage" }
  ] satisfies Array<{ href: string; label: string; permission: Permission }>;
  return items.filter((item) => can(role, item.permission));
}

export function adminNavigationForPermissions(permissions: readonly Permission[]) {
  const allowed = new Set(permissions);
  return adminNavigation("super_admin").filter((item) => allowed.has(item.permission));
}

export function defaultPermissions(role: Role) {
  return [...rolePermissions[role]];
}
