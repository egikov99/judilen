CREATE TABLE "service_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "alt" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "service_images_service_order_unique"
  ON "service_images" ("service_id", "sort_order");
--> statement-breakpoint
CREATE INDEX "service_images_service_idx"
  ON "service_images" ("service_id");
--> statement-breakpoint
INSERT INTO "service_images" ("service_id", "url", "alt", "sort_order")
SELECT "id", "image_url", "title", 0
FROM "services"
WHERE "image_url" IS NOT NULL
  AND trim("image_url") <> '';
--> statement-breakpoint
ALTER TABLE "services" DROP COLUMN "image_url";
