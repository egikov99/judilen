ALTER TABLE "services"
  ADD COLUMN IF NOT EXISTS "min_rental_hours" integer,
  ADD COLUMN IF NOT EXISTS "extension_price" numeric(12, 2);

CREATE TABLE IF NOT EXISTS "gazebos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "short_description" text NOT NULL,
  "description" text NOT NULL,
  "amenities" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_published" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "gazebos_slug_unique" ON "gazebos" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "gazebos_title_unique" ON "gazebos" ("title");
CREATE INDEX IF NOT EXISTS "gazebos_published_order_idx" ON "gazebos" ("is_published", "sort_order");

CREATE TABLE IF NOT EXISTS "gazebo_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "gazebo_id" uuid NOT NULL REFERENCES "gazebos"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "alt" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "gazebo_images_gazebo_order_unique" ON "gazebo_images" ("gazebo_id", "sort_order");
CREATE INDEX IF NOT EXISTS "gazebo_images_gazebo_idx" ON "gazebo_images" ("gazebo_id");

INSERT INTO "permissions" ("key", "description") VALUES
  ('gazebos.read', 'Просмотр беседок'),
  ('gazebos.create', 'Создание беседок'),
  ('gazebos.update', 'Редактирование беседок'),
  ('gazebos.delete', 'Удаление беседок')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.key IN ('gazebos.read', 'gazebos.create', 'gazebos.update', 'gazebos.delete')
WHERE r.name IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.key IN ('gazebos.read', 'gazebos.create', 'gazebos.update')
WHERE r.name = 'content_manager'
ON CONFLICT DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.key = 'gazebos.read'
WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;
