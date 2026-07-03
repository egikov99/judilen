CREATE TABLE "homepage_gallery_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "section_key" text NOT NULL,
  "image_url" text NOT NULL,
  "alt" text NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "homepage_gallery_section_order_unique"
  ON "homepage_gallery_images" ("section_key", "sort_order");
--> statement-breakpoint
CREATE INDEX "homepage_gallery_section_idx"
  ON "homepage_gallery_images" ("section_key");
