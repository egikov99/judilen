CREATE TABLE "push_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "push_subscriptions" ("endpoint");
--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" ("user_id");
--> statement-breakpoint

CREATE TABLE "notification_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "push_enabled" boolean NOT NULL DEFAULT false,
  "event_types" text[] NOT NULL DEFAULT ARRAY[
    'booking_created',
    'customer_message',
    'customer_updated',
    'payment_status',
    'booking_cancelled',
    'arrival_reminder',
    'integration_error'
  ]::text[],
  "reminder_hours" integer NOT NULL DEFAULT 24 CHECK ("reminder_hours" BETWEEN 1 AND 168),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE TABLE "admin_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "title" text NOT NULL,
  "href" text,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE CASCADE,
  "dedupe_key" text NOT NULL,
  "read_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_notifications_user_dedupe_unique"
  ON "admin_notifications" ("user_id", "dedupe_key");
--> statement-breakpoint
CREATE INDEX "admin_notifications_user_created_idx"
  ON "admin_notifications" ("user_id", "created_at");
--> statement-breakpoint

CREATE TABLE "notification_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE SET NULL,
  "status" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "sent_at" timestamptz,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_user_dedupe_unique"
  ON "notification_logs" ("user_id", "dedupe_key");
