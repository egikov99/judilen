CREATE TYPE "service_price_unit" AS ENUM ('hour', 'day', 'booking', 'person', 'item');
--> statement-breakpoint
CREATE TYPE "review_source" AS ENUM ('manual', 'site', 'google', 'booking', 'airbnb');
--> statement-breakpoint

ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'BYN';
--> statement-breakpoint
UPDATE "payments" SET "currency" = 'BYN' WHERE "currency" = 'RUB';
--> statement-breakpoint

ALTER TABLE "house_images" ADD COLUMN "caption" text;
--> statement-breakpoint
ALTER TABLE "house_images" ADD COLUMN "is_main" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "house_images" ADD COLUMN "is_active" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY house_id ORDER BY position, created_at) AS rn
  FROM house_images
)
UPDATE house_images SET is_main = true FROM ranked WHERE house_images.id = ranked.id AND ranked.rn = 1;
--> statement-breakpoint

CREATE TABLE "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "description" text NOT NULL,
  "image_url" text,
  "base_price" numeric(12,2) NOT NULL DEFAULT 0,
  "price_unit" service_price_unit NOT NULL DEFAULT 'booking',
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "services_slug_unique" ON "services" ("slug");
--> statement-breakpoint
CREATE TABLE "service_houses" (
  "service_id" uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  "house_id" uuid NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  PRIMARY KEY ("service_id", "house_id")
);
--> statement-breakpoint
CREATE TABLE "service_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "price" numeric(12,2) NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  "service_id" uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  "service_option_id" uuid REFERENCES service_options(id) ON DELETE RESTRICT,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_price" numeric(12,2) NOT NULL,
  "total_price" numeric(12,2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "reviews" ADD COLUMN "customer_name" text;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "customer_email" text;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "house_id" uuid REFERENCES houses(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "is_published" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "source" review_source NOT NULL DEFAULT 'site';
--> statement-breakpoint
UPDATE "reviews"
SET
  "customer_name" = coalesce(nullif(trim(customers.first_name || ' ' || customers.last_name), ''), customers.email, 'Гость'),
  "customer_email" = customers.email,
  "house_id" = bookings.house_id,
  "is_published" = "reviews"."status" = 'published'
FROM customers, bookings
WHERE reviews.customer_id = customers.id AND reviews.booking_id = bookings.id;
--> statement-breakpoint
UPDATE "reviews" SET "customer_name" = 'Гость' WHERE "customer_name" IS NULL;
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "customer_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "booking_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "reviews_booking_id_key";
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "customer_id" CASCADE;
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "status";
--> statement-breakpoint
ALTER TABLE "reviews" DROP COLUMN IF EXISTS "published_at";
