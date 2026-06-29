import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const roleName = pgEnum("role_name", [
  "client",
  "admin",
  "content_manager",
  "manager"
]);
export const bookingStatus = pgEnum("booking_status", [
  "new",
  "awaiting_confirmation",
  "confirmed",
  "awaiting_payment",
  "paid",
  "cancelled",
  "completed"
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "authorized",
  "paid",
  "failed",
  "refunded"
]);
export const integrationKind = pgEnum("integration_kind", [
  "ical",
  "booking",
  "airbnb",
  "ostrovok",
  "expedia",
  "google_travel"
]);
export const servicePriceUnit = pgEnum("service_price_unit", [
  "hour",
  "day",
  "booking",
  "person",
  "item"
]);
export const reviewSource = pgEnum("review_source", [
  "manual",
  "site",
  "google",
  "booking",
  "airbnb"
]);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: roleName("name").notNull().unique(),
  label: text("label").notNull(),
  ...timestamps
});

export const permissions = pgTable("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  ...timestamps
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
    permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull()
  },
  (table) => [uniqueIndex("role_permission_unique").on(table.roleId, table.permissionId)]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    roleId: uuid("role_id").references(() => roles.id).notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }).unique(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    phone: text("phone").notNull(),
    notes: text("notes"),
    ...timestamps
  },
  (table) => [uniqueIndex("customers_email_unique").on(table.email)]
);

export const houses = pgTable(
  "houses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description").notNull(),
    guests: integer("guests").notNull(),
    rooms: integer("rooms").notNull(),
    amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
    rules: text("rules").notNull().default(""),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull(),
    seoTitle: text("seo_title").notNull(),
    seoDescription: text("seo_description").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    ...timestamps
  },
  (table) => [uniqueIndex("houses_slug_unique").on(table.slug)]
);

export const houseImages = pgTable(
  "house_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull(),
    url: text("url").notNull(),
    alt: text("alt").notNull(),
    caption: text("caption"),
    position: integer("position").notNull().default(0),
    isMain: boolean("is_main").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps
  },
  (table) => [uniqueIndex("house_images_position_unique").on(table.houseId, table.position)]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url"),
    basePrice: numeric("base_price", { precision: 12, scale: 2 }).notNull().default("0"),
    priceUnit: servicePriceUnit("price_unit").notNull().default("booking"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps
  },
  (table) => [uniqueIndex("services_slug_unique").on(table.slug)]
);

export const serviceHouses = pgTable(
  "service_houses",
  {
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull()
  },
  (table) => [primaryKey({ columns: [table.serviceId, table.houseId] })]
);

export const serviceOptions = pgTable("service_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps
});

export const housePrices = pgTable("house_prices", {
  id: uuid("id").defaultRandom().primaryKey(),
  houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  nightlyPrice: numeric("nightly_price", { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicNumber: text("public_number").notNull(),
    houseId: uuid("house_id").references(() => houses.id).notNull(),
    customerId: uuid("customer_id").references(() => customers.id).notNull(),
    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),
    guests: integer("guests").notNull(),
    status: bookingStatus("status").notNull().default("new"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    externalId: text("external_id"),
    externalSource: text("external_source"),
    managerComment: text("manager_comment"),
    cancellationReason: text("cancellation_reason"),
    ...timestamps
  },
  (table) => [uniqueIndex("bookings_public_number_unique").on(table.publicNumber)]
);

export const bookingStatusHistory = pgTable("booking_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  fromStatus: bookingStatus("from_status"),
  toStatus: bookingStatus("to_status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider").notNull(),
  providerPaymentId: text("provider_payment_id"),
  status: paymentStatus("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("BYN"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  ...timestamps
});

export const contentPages = pgTable(
  "content_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>().notNull(),
    seoTitle: text("seo_title").notNull(),
    seoDescription: text("seo_description").notNull(),
    isPublished: boolean("is_published").notNull().default(false),
    ...timestamps
  },
  (table) => [uniqueIndex("content_pages_slug_unique").on(table.slug)]
);

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }),
  kind: integrationKind("kind").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  ...timestamps
});

export const integrationLogs = pgTable("integration_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  integrationId: uuid("integration_id").references(() => integrations.id, { onDelete: "cascade" }).notNull(),
  level: text("level").notNull(),
  message: text("message").notNull(),
  context: jsonb("context").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  before: jsonb("before").$type<unknown>(),
  after: jsonb("after").$type<unknown>(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const reviews = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  rating: integer("rating").notNull(),
  text: text("text").notNull(),
  houseId: uuid("house_id").references(() => houses.id, { onDelete: "set null" }),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  isPublished: boolean("is_published").notNull().default(false),
  source: reviewSource("source").notNull().default("site"),
  ...timestamps
});

export const bookingServices = pgTable("booking_services", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  serviceId: uuid("service_id").references(() => services.id, { onDelete: "restrict" }).notNull(),
  serviceOptionId: uuid("service_option_id").references(() => serviceOptions.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
  ...timestamps
});

export const customerMessages = pgTable("customer_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
