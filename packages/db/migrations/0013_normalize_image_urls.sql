UPDATE "house_images"
SET "url" = regexp_replace(
  replace(trim("url"), E'\\', '/'),
  '^.*(?:public/)?uploads/',
  '/uploads/',
  'i'
)
WHERE trim("url") !~* '^https?://'
  AND replace(trim("url"), E'\\', '/') ~* '(^|/)(?:public/)?uploads/';
--> statement-breakpoint
UPDATE "house_images"
SET "url" = '/' || trim("url")
WHERE trim("url") ~* '^images/';
--> statement-breakpoint
UPDATE "services"
SET "image_url" = regexp_replace(
  replace(trim("image_url"), E'\\', '/'),
  '^.*(?:public/)?uploads/',
  '/uploads/',
  'i'
)
WHERE "image_url" IS NOT NULL
  AND trim("image_url") !~* '^https?://'
  AND replace(trim("image_url"), E'\\', '/') ~* '(^|/)(?:public/)?uploads/';
--> statement-breakpoint
UPDATE "services"
SET "image_url" = '/' || trim("image_url")
WHERE "image_url" IS NOT NULL
  AND trim("image_url") ~* '^images/';
--> statement-breakpoint
UPDATE "services"
SET "image_url" = NULL
WHERE "image_url" IS NOT NULL
  AND lower(trim("image_url")) IN ('', 'undefined', 'null');
