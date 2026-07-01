CREATE TEMP TABLE service_dedupe_map AS
SELECT id AS duplicate_id, keeper_id
FROM (
  SELECT
    id,
    first_value(id) OVER (PARTITION BY title ORDER BY created_at, id) AS keeper_id
  FROM services
) ranked
WHERE id <> keeper_id;
--> statement-breakpoint
INSERT INTO service_houses (service_id, house_id)
SELECT DISTINCT map.keeper_id, links.house_id
FROM service_dedupe_map map
JOIN service_houses links ON links.service_id = map.duplicate_id
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE service_options options
SET service_id = map.keeper_id
FROM service_dedupe_map map
WHERE options.service_id = map.duplicate_id;
--> statement-breakpoint
UPDATE booking_services lines
SET service_id = map.keeper_id
FROM service_dedupe_map map
WHERE lines.service_id = map.duplicate_id;
--> statement-breakpoint
DELETE FROM services
USING service_dedupe_map map
WHERE services.id = map.duplicate_id;
--> statement-breakpoint
DROP TABLE service_dedupe_map;
--> statement-breakpoint
CREATE UNIQUE INDEX "services_title_unique" ON "services" ("title");
--> statement-breakpoint

CREATE TEMP TABLE service_option_dedupe_map AS
SELECT id AS duplicate_id, keeper_id
FROM (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY service_id, title, price
      ORDER BY created_at, id
    ) AS keeper_id
  FROM service_options
) ranked
WHERE id <> keeper_id;
--> statement-breakpoint
WITH duplicate_values AS (
  SELECT
    map.keeper_id,
    bool_or(options.is_default) AS is_default,
    bool_or(options.is_active) AS is_active,
    max(options.updated_at) AS updated_at
  FROM service_option_dedupe_map map
  JOIN service_options options ON options.id = map.duplicate_id
  GROUP BY map.keeper_id
)
UPDATE service_options keeper
SET
  is_default = keeper.is_default OR duplicate_values.is_default,
  is_active = keeper.is_active OR duplicate_values.is_active,
  updated_at = greatest(keeper.updated_at, duplicate_values.updated_at)
FROM duplicate_values
WHERE keeper.id = duplicate_values.keeper_id;
--> statement-breakpoint
UPDATE booking_services lines
SET service_option_id = map.keeper_id
FROM service_option_dedupe_map map
WHERE lines.service_option_id = map.duplicate_id;
--> statement-breakpoint
DELETE FROM service_options
USING service_option_dedupe_map map
WHERE service_options.id = map.duplicate_id;
--> statement-breakpoint
DROP TABLE service_option_dedupe_map;
--> statement-breakpoint
CREATE UNIQUE INDEX "service_options_identity_unique"
  ON "service_options" ("service_id", "title", "price");
--> statement-breakpoint

CREATE TEMP TABLE review_dedupe_map AS
SELECT id AS duplicate_id, keeper_id
FROM (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY customer_name, text, house_id
      ORDER BY created_at, id
    ) AS keeper_id
  FROM reviews
) ranked
WHERE id <> keeper_id;
--> statement-breakpoint
WITH duplicate_values AS (
  SELECT
    map.keeper_id,
    max(review.customer_email) FILTER (WHERE review.customer_email IS NOT NULL) AS customer_email,
    (max(review.booking_id::text) FILTER (WHERE review.booking_id IS NOT NULL))::uuid AS booking_id,
    bool_or(review.is_published) AS is_published,
    max(review.updated_at) AS updated_at
  FROM review_dedupe_map map
  JOIN reviews review ON review.id = map.duplicate_id
  GROUP BY map.keeper_id
)
UPDATE reviews keeper
SET
  customer_email = coalesce(keeper.customer_email, duplicate_values.customer_email),
  booking_id = coalesce(keeper.booking_id, duplicate_values.booking_id),
  is_published = keeper.is_published OR duplicate_values.is_published,
  updated_at = greatest(keeper.updated_at, duplicate_values.updated_at)
FROM duplicate_values
WHERE keeper.id = duplicate_values.keeper_id;
--> statement-breakpoint
DELETE FROM reviews
USING review_dedupe_map map
WHERE reviews.id = map.duplicate_id;
--> statement-breakpoint
DROP TABLE review_dedupe_map;
--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_identity_with_house_unique"
  ON "reviews" ("customer_name", md5("text"), "house_id")
  WHERE "house_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_identity_without_house_unique"
  ON "reviews" ("customer_name", md5("text"))
  WHERE "house_id" IS NULL;
