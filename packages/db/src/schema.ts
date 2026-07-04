import {
  boolean,
  date,
  integer,
  index,
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
import { sql } from "drizzle-orm";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
};

export const roleName = pgEnum("role_name", [
  "client",
  "super_admin",
  "admin",
  "content_manager",
  "manager",
  "viewer"
]);
export const bookingStatus = pgEnum("booking_status", [
  "new",
  "pending",
  "awaiting_confirmation",
  "confirmed",
  "awaiting_payment",
  "paid",
  "external",
  "blocked",
  "cancelled",
  "declined",
  "import_removed",
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
  "google_travel",
  "tripadvisor",
  "other"
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
export const reviewModerationStatus = pgEnum("review_moderation_status", [
  "pending",
  "published",
  "rejected"
]);
export const houseWeekday = pgEnum("house_weekday", [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
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
    internalNote: text("internal_note"),
    isActive: boolean("is_active").notNull().default(true),
    sessionVersion: integer("session_version").notNull().default(0),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

export const userPermissionOverrides = pgTable(
  "user_permission_overrides",
  {
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
    isGranted: boolean("is_granted").notNull(),
    ...timestamps
  },
  (table) => [primaryKey({ columns: [table.userId, table.permissionId] })]
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
  (table) => [
    uniqueIndex("house_images_position_unique").on(table.houseId, table.position),
    uniqueIndex("house_images_one_main").on(table.houseId).where(sql`${table.isMain} = true`)
  ]
);

export const houseWeekdayPrices = pgTable(
  "house_weekday_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull(),
    weekday: houseWeekday("weekday").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("house_weekday_prices_house_weekday_unique").on(table.houseId, table.weekday),
    index("house_weekday_prices_house_idx").on(table.houseId)
  ]
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
  (table) => [
    uniqueIndex("services_slug_unique").on(table.slug),
    uniqueIndex("services_title_unique").on(table.title)
  ]
);

export const serviceHouses = pgTable(
  "service_houses",
  {
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull()
  },
  (table) => [primaryKey({ columns: [table.serviceId, table.houseId] })]
);

export const serviceOptions = pgTable(
  "service_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "cascade" }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps
  },
  (table) => [
    uniqueIndex("service_options_identity_unique").on(table.serviceId, table.title, table.price)
  ]
);

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
    source: text("source").notNull().default("site"),
    totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    paymentMethod: text("payment_method").notNull().default("on_arrival"),
    paymentStatus: text("payment_status").notNull().default("unpaid"),
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

export const bookingNightlyPrices = pgTable(
  "booking_nightly_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
    nightDate: date("night_date").notNull(),
    weekday: houseWeekday("weekday").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("booking_nightly_prices_booking_date_unique").on(table.bookingId, table.nightDate),
    index("booking_nightly_prices_booking_idx").on(table.bookingId)
  ]
);

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

export const homepageGalleryImages = pgTable(
  "homepage_gallery_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionKey: text("section_key").notNull(),
    imageUrl: text("image_url").notNull(),
    alt: text("alt").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps
  },
  (table) => [
    uniqueIndex("homepage_gallery_section_order_unique").on(table.sectionKey, table.sortOrder),
    index("homepage_gallery_section_idx").on(table.sectionKey)
  ]
);

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }),
  kind: integrationKind("kind").notNull(),
  name: text("name").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  importedCount: integer("imported_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
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

export const externalCalendars = pgTable(
  "external_calendars",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integrationId: uuid("integration_id").references(() => integrations.id, { onDelete: "set null" }),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull(),
    provider: integrationKind("provider").notNull().default("ical"),
    name: text("name").notNull(),
    importUrl: text("import_url"),
    exportToken: uuid("export_token").defaultRandom().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(60),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps
  },
  (table) => [uniqueIndex("external_calendars_export_token_unique").on(table.exportToken)]
);

export const bookingExternalRefs = pgTable(
  "booking_external_refs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
    provider: integrationKind("provider").notNull(),
    externalId: text("external_id"),
    externalUid: text("external_uid").notNull(),
    externalCalendarId: uuid("external_calendar_id").references(() => externalCalendars.id, { onDelete: "cascade" }).notNull(),
    rawPayload: jsonb("raw_payload_json").$type<Record<string, unknown>>(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps
  },
  (table) => [
    uniqueIndex("booking_external_refs_calendar_uid_unique").on(table.externalCalendarId, table.externalUid),
    uniqueIndex("booking_external_refs_booking_unique").on(table.bookingId)
  ]
);

export const calendarConflicts = pgTable(
  "calendar_conflicts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "cascade" }).notNull(),
    externalCalendarId: uuid("external_calendar_id").references(() => externalCalendars.id, { onDelete: "cascade" }).notNull(),
    source: text("source").notNull(),
    externalUid: text("external_uid").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    summary: text("summary").notNull(),
    rawPayload: jsonb("raw_payload_json").$type<Record<string, unknown>>(),
    status: text("status").notNull().default("open"),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionNote: text("resolution_note"),
    ...timestamps
  },
  (table) => [uniqueIndex("calendar_conflicts_open_event_unique").on(table.externalCalendarId, table.externalUid).where(sql`${table.status} = 'open'`)]
);

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

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    rating: integer("rating").notNull(),
    text: text("text").notNull(),
    houseId: uuid("house_id").references(() => houses.id, { onDelete: "set null" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    isPublished: boolean("is_published").notNull().default(false),
    status: reviewModerationStatus("status").notNull().default("pending"),
    source: reviewSource("source").notNull().default("site"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("reviews_identity_with_house_unique")
      .on(table.customerName, sql`md5(${table.text})`, table.houseId)
      .where(sql`${table.houseId} is not null`),
    uniqueIndex("reviews_identity_without_house_unique")
      .on(table.customerName, sql`md5(${table.text})`)
      .where(sql`${table.houseId} is null`),
    uniqueIndex("reviews_booking_unique")
      .on(table.bookingId)
      .where(sql`${table.bookingId} is not null`)
  ]
);

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

export const communicationChannels = pgTable(
  "communication_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    isEnabled: boolean("is_enabled").notNull().default(false),
    status: text("status").notNull().default("disconnected"),
    publicConfig: jsonb("public_config").$type<Record<string, string>>().notNull().default({}),
    secretConfigEncrypted: text("secret_config_encrypted"),
    webhookSecret: text("webhook_secret").notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("communication_channels_provider_unique").on(table.provider),
    uniqueIndex("communication_channels_webhook_secret_unique").on(table.webhookSecret)
  ]
);

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id").references(() => communicationChannels.id, { onDelete: "cascade" }).notNull(),
    externalChatId: text("external_chat_id").notNull(),
    externalUserId: text("external_user_id"),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    isGroup: boolean("is_group").notNull().default(false),
    unreadCount: integer("unread_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    lastMessagePreview: text("last_message_preview"),
    ...timestamps
  },
  (table) => [
    uniqueIndex("chat_conversations_channel_external_unique").on(table.channelId, table.externalChatId),
    index("chat_conversations_last_message_idx").on(table.lastMessageAt)
  ]
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").references(() => chatConversations.id, { onDelete: "cascade" }).notNull(),
    externalMessageId: text("external_message_id"),
    direction: text("direction").notNull(),
    senderName: text("sender_name"),
    body: text("body").notNull(),
    status: text("status").notNull(),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, { onDelete: "set null" }),
    rawPayload: jsonb("raw_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("chat_messages_conversation_external_unique").on(table.conversationId, table.externalMessageId),
    index("chat_messages_conversation_created_idx").on(table.conversationId, table.createdAt)
  ]
);

export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").references(() => chatMessages.id, { onDelete: "cascade" }).notNull(),
    kind: text("kind").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    storagePath: text("storage_path").notNull(),
    externalFileId: text("external_file_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("chat_attachments_message_external_unique").on(table.messageId, table.externalFileId),
    index("chat_attachments_message_idx").on(table.messageId)
  ]
);

export const vkIntegrations = pgTable(
  "vk_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    communicationChannelId: uuid("communication_channel_id")
      .references(() => communicationChannels.id, { onDelete: "set null" }),
    groupId: text("group_id").notNull(),
    groupName: text("group_name"),
    apiVersion: text("api_version").notNull().default("5.199"),
    callbackUrl: text("callback_url").notNull(),
    confirmationToken: text("confirmation_token").notNull(),
    secretKey: text("secret_key").notNull(),
    accessToken: text("access_token").notNull(),
    status: text("status").notNull().default("pending"),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => [
    uniqueIndex("vk_integrations_group_unique").on(table.groupId),
    uniqueIndex("vk_integrations_channel_unique").on(table.communicationChannelId)
  ]
);

export const vkEventsLog = pgTable(
  "vk_events_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integrationId: uuid("integration_id")
      .references(() => vkIntegrations.id, { onDelete: "cascade" })
      .notNull(),
    groupId: text("group_id").notNull(),
    eventType: text("event_type").notNull(),
    eventId: text("event_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("vk_events_log_event_unique").on(table.integrationId, table.eventId),
    index("vk_events_log_integration_created_idx").on(table.integrationId, table.createdAt)
  ]
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint),
    index("push_subscriptions_user_idx").on(table.userId)
  ]
);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  pushEnabled: boolean("push_enabled").notNull().default(false),
  eventTypes: text("event_types").array().notNull().default(sql`ARRAY[
    'booking_created',
    'customer_message',
    'customer_updated',
    'payment_status',
    'booking_cancelled',
    'arrival_reminder',
    'integration_error'
  ]::text[]`),
  reminderHours: integer("reminder_hours").notNull().default(24),
  ...timestamps
});

export const adminNotifications = pgTable(
  "admin_notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    href: text("href"),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("admin_notifications_user_dedupe_unique").on(table.userId, table.dedupeKey),
    index("admin_notifications_user_created_idx").on(table.userId, table.createdAt)
  ]
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    eventType: text("event_type").notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("notification_logs_user_dedupe_unique").on(table.userId, table.dedupeKey)
  ]
);

export const siteThemeSettings = pgTable("site_theme_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  primaryColor: text("primary_color").notNull(),
  buttonColor: text("button_color").notNull(),
  buttonHoverColor: text("button_hover_color").notNull(),
  backgroundColor: text("background_color").notNull(),
  cardColor: text("card_color").notNull(),
  textColor: text("text_color").notNull(),
  accentColor: text("accent_color").notNull(),
  headerColor: text("header_color").notNull(),
  footerColor: text("footer_color").notNull(),
  ...timestamps
});

export const smtpSettings = pgTable("smtp_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username"),
  passwordEncrypted: text("password_encrypted"),
  encryption: text("encryption").notNull().default("starttls"),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  replyToEmail: text("reply_to_email"),
  status: text("status").notNull().default("not_configured"),
  lastError: text("last_error"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  ...timestamps
});

export const emailTemplates = pgTable("email_templates", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  textContent: text("text_content").notNull(),
  ...timestamps
});

export const emailLogs = pgTable(
  "email_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipient: text("recipient").notNull(),
    templateKey: text("template_key").notNull(),
    subject: text("subject").notNull(),
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    dedupeKey: text("dedupe_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("email_logs_dedupe_unique").on(table.dedupeKey),
    index("email_logs_created_idx").on(table.createdAt)
  ]
);

export const contactWidgetSettings = pgTable(
  "contact_widget_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelType: text("channel_type").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    displayName: text("display_name").notNull(),
    subtitle: text("subtitle"),
    url: text("url"),
    phone: text("phone"),
    username: text("username"),
    defaultMessage: text("default_message"),
    sortOrder: integer("sort_order").notNull().default(0),
    icon: text("icon"),
    ...timestamps
  },
  (table) => [uniqueIndex("contact_widget_settings_channel_unique").on(table.channelType)]
);
