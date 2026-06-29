CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";
--> statement-breakpoint

CREATE TYPE "role_name" AS ENUM ('client', 'admin', 'content_manager', 'manager');
--> statement-breakpoint
CREATE TYPE "booking_status" AS ENUM ('new', 'awaiting_confirmation', 'confirmed', 'awaiting_payment', 'paid', 'cancelled', 'completed');
--> statement-breakpoint
CREATE TYPE "payment_status" AS ENUM ('pending', 'authorized', 'paid', 'failed', 'refunded');
--> statement-breakpoint
CREATE TYPE "integration_kind" AS ENUM ('ical', 'booking', 'airbnb', 'ostrovok', 'expedia', 'google_travel');
--> statement-breakpoint

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" role_name NOT NULL UNIQUE,
  "label" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" text NOT NULL UNIQUE,
  "description" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "role_permission_unique" ON "role_permissions" ("role_id", "permission_id");
--> statement-breakpoint
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL,
  "password_hash" text NOT NULL,
  "role_id" uuid NOT NULL REFERENCES roles(id),
  "first_name" text NOT NULL,
  "last_name" text NOT NULL DEFAULT '',
  "phone" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");
--> statement-breakpoint
CREATE TABLE "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  "email" text NOT NULL,
  "first_name" text NOT NULL,
  "last_name" text NOT NULL DEFAULT '',
  "phone" text NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "customers_email_unique" ON "customers" ("email");
--> statement-breakpoint
CREATE TABLE "houses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "short_description" text NOT NULL,
  "description" text NOT NULL,
  "guests" integer NOT NULL CHECK ("guests" > 0),
  "rooms" integer NOT NULL CHECK ("rooms" > 0),
  "amenities" jsonb NOT NULL DEFAULT '[]',
  "rules" text NOT NULL DEFAULT '',
  "base_price" numeric(12,2) NOT NULL CHECK ("base_price" >= 0),
  "seo_title" text NOT NULL,
  "seo_description" text NOT NULL,
  "is_published" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "house_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "house_id" uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  "url" text NOT NULL,
  "alt" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "house_images_position_unique" ON "house_images" ("house_id", "position");
--> statement-breakpoint
CREATE TABLE "house_prices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "house_id" uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  "name" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "nightly_price" numeric(12,2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("end_date" > "start_date")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_number" text NOT NULL UNIQUE,
  "house_id" uuid NOT NULL REFERENCES houses(id),
  "customer_id" uuid NOT NULL REFERENCES customers(id),
  "check_in" date NOT NULL,
  "check_out" date NOT NULL,
  "guests" integer NOT NULL CHECK ("guests" > 0),
  "status" booking_status NOT NULL DEFAULT 'new',
  "total_amount" numeric(12,2) NOT NULL CHECK ("total_amount" >= 0),
  "paid_amount" numeric(12,2) NOT NULL DEFAULT 0 CHECK ("paid_amount" >= 0),
  "external_id" text,
  "external_source" text,
  "manager_comment" text,
  "cancellation_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("check_out" > "check_in")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "house_id" WITH =,
    daterange("check_in", "check_out", '[)') WITH &&
  ) WHERE ("status" IN ('awaiting_confirmation', 'confirmed', 'awaiting_payment', 'paid'));
--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_external_unique"
  ON "bookings" ("external_source", "external_id")
  WHERE "external_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "booking_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  "from_status" booking_status,
  "to_status" booking_status NOT NULL,
  "changed_by" uuid REFERENCES users(id) ON DELETE SET NULL,
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  "provider" text NOT NULL,
  "provider_payment_id" text,
  "status" payment_status NOT NULL DEFAULT 'pending',
  "amount" numeric(12,2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'BYN',
  "payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug" text NOT NULL UNIQUE,
  "title" text NOT NULL,
  "content" jsonb NOT NULL,
  "seo_title" text NOT NULL,
  "seo_description" text NOT NULL,
  "is_published" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "house_id" uuid REFERENCES houses(id) ON DELETE CASCADE,
  "kind" integration_kind NOT NULL,
  "name" text NOT NULL,
  "config" jsonb NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "last_synced_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  "level" text NOT NULL,
  "message" text NOT NULL,
  "context" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
  "key" text PRIMARY KEY,
  "value" jsonb NOT NULL,
  "is_secret" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" uuid REFERENCES users(id) ON DELETE SET NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" text,
  "before" jsonb,
  "after" jsonb,
  "ip" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "bookings_house_dates_idx" ON "bookings" ("house_id", "check_in", "check_out");
--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" ("customer_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" ("entity_type", "entity_id");
--> statement-breakpoint
CREATE TABLE "reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  "customer_id" uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  "rating" integer NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
  "text" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'published', 'rejected')),
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customer_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  "author_user_id" uuid REFERENCES users(id) ON DELETE SET NULL,
  "message" text NOT NULL,
  "is_internal" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" ("user_id");
