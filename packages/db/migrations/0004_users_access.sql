ALTER TABLE "roles" ALTER COLUMN "name" TYPE text USING "name"::text;
DROP TYPE "role_name";
CREATE TYPE "role_name" AS ENUM ('client', 'super_admin', 'admin', 'content_manager', 'manager', 'viewer');
ALTER TABLE "roles" ALTER COLUMN "name" TYPE role_name USING "name"::role_name;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "internal_note" text;
ALTER TABLE "users" ADD COLUMN "session_version" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE "user_permission_overrides" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "permission_id" uuid NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  "is_granted" boolean NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "permission_id")
);
--> statement-breakpoint
INSERT INTO "roles" ("name", "label") VALUES
  ('super_admin', 'Суперадминистратор'),
  ('viewer', 'Наблюдатель')
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint
UPDATE "users"
SET "role_id" = (SELECT "id" FROM "roles" WHERE "name" = 'super_admin')
WHERE "id" = (
  SELECT u."id"
  FROM "users" u
  JOIN "roles" r ON r."id" = u."role_id"
  WHERE r."name" = 'admin' AND u."is_active" = true
  ORDER BY u."created_at"
  LIMIT 1
);
