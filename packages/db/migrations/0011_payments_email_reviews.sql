CREATE TYPE "review_moderation_status" AS ENUM ('pending', 'published', 'rejected');
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN "payment_method" text NOT NULL DEFAULT 'on_arrival',
  ADD COLUMN "payment_status" text NOT NULL DEFAULT 'unpaid';
--> statement-breakpoint
ALTER TABLE "reviews"
  ADD COLUMN "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "status" "review_moderation_status" NOT NULL DEFAULT 'pending';
--> statement-breakpoint
UPDATE "reviews"
SET "status" = CASE WHEN "is_published" THEN 'published'::"review_moderation_status" ELSE 'pending'::"review_moderation_status" END;
--> statement-breakpoint
UPDATE "reviews" review
SET "user_id" = customer."user_id"
FROM "bookings" booking
JOIN "customers" customer ON customer."id" = booking."customer_id"
WHERE review."booking_id" = booking."id" AND customer."user_id" IS NOT NULL;
--> statement-breakpoint
DELETE FROM "reviews" duplicate
USING "reviews" keeper
WHERE duplicate."booking_id" = keeper."booking_id"
  AND duplicate."booking_id" IS NOT NULL
  AND (duplicate."created_at", duplicate."id") > (keeper."created_at", keeper."id");
--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_booking_unique" ON "reviews" ("booking_id") WHERE "booking_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "smtp_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "host" text NOT NULL,
  "port" integer NOT NULL,
  "username" text,
  "password_encrypted" text,
  "encryption" text NOT NULL DEFAULT 'starttls',
  "from_email" text NOT NULL,
  "from_name" text NOT NULL,
  "reply_to_email" text,
  "status" text NOT NULL DEFAULT 'not_configured',
  "last_error" text,
  "last_checked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
  "key" text PRIMARY KEY,
  "name" text NOT NULL,
  "subject" text NOT NULL,
  "html_content" text NOT NULL,
  "text_content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient" text NOT NULL,
  "template_key" text NOT NULL,
  "subject" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "error_message" text,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "dedupe_key" text NOT NULL,
  "sent_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "email_logs_dedupe_unique" ON "email_logs" ("dedupe_key");
--> statement-breakpoint
CREATE INDEX "email_logs_created_idx" ON "email_logs" ("created_at");
