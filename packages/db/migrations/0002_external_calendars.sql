ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "bookings_no_overlap";
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "booking_status_history" ALTER COLUMN "from_status" TYPE text USING "from_status"::text;
ALTER TABLE "booking_status_history" ALTER COLUMN "to_status" TYPE text USING "to_status"::text;
DROP TYPE "booking_status";
CREATE TYPE "booking_status" AS ENUM (
  'new', 'pending', 'awaiting_confirmation', 'confirmed', 'awaiting_payment',
  'paid', 'external', 'blocked', 'cancelled', 'declined', 'import_removed', 'completed'
);
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE booking_status USING "status"::booking_status;
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'new';
ALTER TABLE "booking_status_history" ALTER COLUMN "from_status" TYPE booking_status USING "from_status"::booking_status;
ALTER TABLE "booking_status_history" ALTER COLUMN "to_status" TYPE booking_status USING "to_status"::booking_status;
ALTER TABLE "integrations" ALTER COLUMN "kind" TYPE text USING "kind"::text;
DROP TYPE "integration_kind";
CREATE TYPE "integration_kind" AS ENUM ('ical', 'booking', 'airbnb', 'ostrovok', 'expedia', 'google_travel', 'tripadvisor', 'other');
ALTER TABLE "integrations" ALTER COLUMN "kind" TYPE integration_kind USING "kind"::integration_kind;
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source" text NOT NULL DEFAULT 'site';
UPDATE "bookings"
SET "source" = CASE
  WHEN "external_source" LIKE 'ical:%' THEN 'ical'
  WHEN "external_source" IS NOT NULL THEN "external_source"
  ELSE 'site'
END;
ALTER TABLE "integrations" ADD COLUMN "imported_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "integrations" ADD COLUMN "error_count" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE "external_calendars" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" uuid REFERENCES "integrations"("id") ON DELETE SET NULL,
  "house_id" uuid NOT NULL REFERENCES "houses"("id") ON DELETE CASCADE,
  "provider" integration_kind NOT NULL DEFAULT 'ical',
  "name" text NOT NULL,
  "import_url" text,
  "export_token" uuid NOT NULL DEFAULT gen_random_uuid(),
  "is_active" boolean NOT NULL DEFAULT true,
  "sync_interval_minutes" integer NOT NULL DEFAULT 60 CHECK ("sync_interval_minutes" >= 5),
  "last_sync_at" timestamptz,
  "last_success_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "external_calendars_export_token_unique" ON "external_calendars" ("export_token");
--> statement-breakpoint
INSERT INTO "external_calendars" ("integration_id", "house_id", "provider", "name", "import_url", "is_active", "last_sync_at", "last_success_at")
SELECT "id", "house_id", 'ical', "name", "config"->>'url', "is_enabled", "last_synced_at", "last_synced_at"
FROM "integrations"
WHERE "kind" = 'ical' AND "house_id" IS NOT NULL AND "config"->>'url' IS NOT NULL;
--> statement-breakpoint
CREATE TABLE "booking_external_refs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "provider" integration_kind NOT NULL,
  "external_id" text,
  "external_uid" text NOT NULL,
  "external_calendar_id" uuid NOT NULL REFERENCES "external_calendars"("id") ON DELETE CASCADE,
  "raw_payload_json" jsonb,
  "last_synced_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "booking_external_refs_calendar_uid_unique" ON "booking_external_refs" ("external_calendar_id", "external_uid");
CREATE UNIQUE INDEX "booking_external_refs_booking_unique" ON "booking_external_refs" ("booking_id");
--> statement-breakpoint
INSERT INTO "booking_external_refs" ("booking_id", "provider", "external_id", "external_uid", "external_calendar_id", "last_synced_at")
SELECT b."id", 'ical', b."external_id", b."external_id", ec."id", b."updated_at"
FROM "bookings" b
JOIN "external_calendars" ec ON b."external_source" = 'ical:' || ec."integration_id"::text
WHERE b."external_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE "calendar_conflicts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "house_id" uuid NOT NULL REFERENCES "houses"("id") ON DELETE CASCADE,
  "external_calendar_id" uuid NOT NULL REFERENCES "external_calendars"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "external_uid" text NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "summary" text NOT NULL,
  "raw_payload_json" jsonb,
  "status" text NOT NULL DEFAULT 'open',
  "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "resolved_at" timestamptz,
  "resolution_note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("end_date" > "start_date")
);
CREATE UNIQUE INDEX "calendar_conflicts_open_event_unique" ON "calendar_conflicts" ("external_calendar_id", "external_uid") WHERE "status" = 'open';
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "house_id" WITH =,
    daterange("check_in", "check_out", '[)') WITH &&
  ) WHERE ("status" IN ('pending', 'awaiting_confirmation', 'confirmed', 'awaiting_payment', 'paid', 'external', 'blocked'));
