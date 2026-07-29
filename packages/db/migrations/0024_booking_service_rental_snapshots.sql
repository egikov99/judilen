ALTER TABLE "booking_services"
  ADD COLUMN "min_rental_hours" integer,
  ADD COLUMN "extension_price" numeric(12, 2);
--> statement-breakpoint
UPDATE "booking_services" line
SET
  "min_rental_hours" = service."min_rental_hours",
  "extension_price" = service."extension_price"
FROM "services" service
WHERE service."id" = line."service_id";
