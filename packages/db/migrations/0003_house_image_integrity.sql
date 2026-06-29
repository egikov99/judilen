WITH ranked AS (
  SELECT "id", row_number() OVER (PARTITION BY "house_id" ORDER BY "position", "created_at") AS rank
  FROM "house_images"
  WHERE "is_main" = true
)
UPDATE "house_images"
SET "is_main" = false
WHERE "id" IN (SELECT "id" FROM ranked WHERE rank > 1);
--> statement-breakpoint
CREATE UNIQUE INDEX "house_images_one_main" ON "house_images" ("house_id") WHERE "is_main" = true;
