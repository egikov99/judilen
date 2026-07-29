ALTER TABLE "bookings"
  ADD COLUMN "accommodation_amount" numeric(12, 2);
--> statement-breakpoint
UPDATE "bookings" booking
SET "accommodation_amount" = greatest(
  booking."total_amount" - coalesce((
    SELECT sum(line."total_price")
    FROM "booking_services" line
    WHERE line."booking_id" = booking."id"
  ), 0),
  0
);
--> statement-breakpoint
ALTER TABLE "bookings"
  ALTER COLUMN "accommodation_amount" SET DEFAULT 0,
  ALTER COLUMN "accommodation_amount" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_accommodation_amount_nonnegative_check" CHECK ("accommodation_amount" >= 0);
--> statement-breakpoint
ALTER TABLE "booking_services"
  ADD COLUMN "service_title" text,
  ADD COLUMN "option_title" text,
  ADD COLUMN "price_unit" "service_price_unit";
--> statement-breakpoint
UPDATE "booking_services" line
SET
  "service_title" = service."title",
  "option_title" = (
    SELECT option."title"
    FROM "service_options" option
    WHERE option."id" = line."service_option_id"
  ),
  "price_unit" = service."price_unit"
FROM "services" service
WHERE service."id" = line."service_id";
--> statement-breakpoint
ALTER TABLE "booking_services"
  ALTER COLUMN "service_title" SET NOT NULL,
  ALTER COLUMN "price_unit" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "booking_services"
  ADD CONSTRAINT "booking_services_quantity_positive_check" CHECK ("quantity" > 0) NOT VALID,
  ADD CONSTRAINT "booking_services_unit_price_nonnegative_check" CHECK ("unit_price" >= 0) NOT VALID,
  ADD CONSTRAINT "booking_services_total_price_nonnegative_check" CHECK ("total_price" >= 0) NOT VALID;
