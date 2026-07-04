CREATE TYPE "house_weekday" AS ENUM (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);
--> statement-breakpoint
CREATE TABLE "house_weekday_prices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "house_id" uuid NOT NULL REFERENCES "houses"("id") ON DELETE CASCADE,
  "weekday" "house_weekday" NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "house_weekday_prices_positive_check" CHECK ("price" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "house_weekday_prices_house_weekday_unique"
  ON "house_weekday_prices" ("house_id", "weekday");
--> statement-breakpoint
CREATE INDEX "house_weekday_prices_house_idx"
  ON "house_weekday_prices" ("house_id");
--> statement-breakpoint
INSERT INTO "house_weekday_prices" ("house_id", "weekday", "price")
SELECT
  "houses"."id",
  "weekdays"."weekday"::"house_weekday",
  "houses"."base_price"
FROM "houses"
CROSS JOIN (
  VALUES
    ('monday'),
    ('tuesday'),
    ('wednesday'),
    ('thursday'),
    ('friday'),
    ('saturday'),
    ('sunday')
) AS "weekdays"("weekday")
ON CONFLICT ("house_id", "weekday") DO NOTHING;
--> statement-breakpoint
CREATE TABLE "booking_nightly_prices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "night_date" date NOT NULL,
  "weekday" "house_weekday" NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "booking_nightly_prices_positive_check" CHECK ("price" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_nightly_prices_booking_date_unique"
  ON "booking_nightly_prices" ("booking_id", "night_date");
--> statement-breakpoint
CREATE INDEX "booking_nightly_prices_booking_idx"
  ON "booking_nightly_prices" ("booking_id");
