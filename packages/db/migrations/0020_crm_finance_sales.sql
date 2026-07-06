CREATE TABLE "sales_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "color" text NOT NULL DEFAULT '#2d5a27',
  "icon" text NOT NULL DEFAULT 'circle',
  "is_active" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sales_channels_slug_unique" ON "sales_channels" ("slug");
--> statement-breakpoint
CREATE INDEX "sales_channels_active_order_idx" ON "sales_channels" ("is_active", "sort_order");
--> statement-breakpoint
INSERT INTO "sales_channels" ("name", "slug", "color", "icon", "sort_order") VALUES
  ('Сайт', 'site', '#2d5a27', 'globe', 10),
  ('Телефон', 'phone', '#315f86', 'phone', 20),
  ('Instagram', 'instagram', '#b54476', 'instagram', 30),
  ('VK', 'vk', '#447bba', 'message-circle', 40),
  ('Booking', 'booking', '#164b9b', 'building', 50),
  ('Airbnb', 'airbnb', '#e35763', 'home', 60),
  ('Ostrovok', 'ostrovok', '#ef7e22', 'hotel', 70),
  ('Яндекс Путешествия', 'yandex-travel', '#d7352a', 'map', 80),
  ('Рекомендация', 'recommendation', '#7a5f3f', 'users', 90),
  ('Постоянный клиент', 'returning-customer', '#66539b', 'heart', 100),
  ('Другое', 'other', '#667066', 'circle', 110)
ON CONFLICT ("slug") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "bookings"
  ADD COLUMN "sales_channel_id" uuid REFERENCES "sales_channels"("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "bookings"
SET "sales_channel_id" = (SELECT "id" FROM "sales_channels" WHERE "slug" = 'site')
WHERE "source" = 'site' AND "sales_channel_id" IS NULL;
--> statement-breakpoint
CREATE INDEX "bookings_sales_channel_idx" ON "bookings" ("sales_channel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_house_idx" ON "bookings" ("house_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_check_in_idx" ON "bookings" ("check_in");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_created_at_idx" ON "bookings" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_payment_status_idx" ON "bookings" ("payment_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_services_booking_idx" ON "booking_services" ("booking_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_services_service_idx" ON "booking_services" ("service_id");
--> statement-breakpoint

CREATE TABLE "expense_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#9b4a32',
  "icon" text NOT NULL DEFAULT 'receipt',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_name_unique" ON "expense_categories" ("name");
--> statement-breakpoint
CREATE INDEX "expense_categories_active_order_idx" ON "expense_categories" ("is_active", "sort_order");
--> statement-breakpoint
INSERT INTO "expense_categories" ("name", "color", "icon", "sort_order") VALUES
  ('Коммунальные услуги', '#315f86', 'zap', 10),
  ('Ремонт и обслуживание', '#9b4a32', 'wrench', 20),
  ('Закупки', '#7a5f3f', 'shopping-cart', 30),
  ('Зарплата', '#66539b', 'users', 40),
  ('Реклама', '#b54476', 'megaphone', 50),
  ('Прочее', '#667066', 'receipt', 60)
ON CONFLICT ("name") DO NOTHING;
--> statement-breakpoint

CREATE TABLE "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "expense_date" date NOT NULL,
  "amount" numeric(12, 2) NOT NULL CHECK ("amount" > 0),
  "expense_category_id" uuid NOT NULL REFERENCES "expense_categories"("id"),
  "house_id" uuid REFERENCES "houses"("id") ON DELETE SET NULL,
  "comment" text,
  "receipt_file" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" ("expense_date");
--> statement-breakpoint
CREATE INDEX "expenses_house_idx" ON "expenses" ("house_id");
--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" ("expense_category_id");
--> statement-breakpoint
CREATE INDEX "expenses_created_by_idx" ON "expenses" ("created_by");
--> statement-breakpoint

CREATE TABLE "client_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL REFERENCES "customers"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "client_notes_client_idx" ON "client_notes" ("client_id");
--> statement-breakpoint
CREATE INDEX "client_notes_author_idx" ON "client_notes" ("author_id");
--> statement-breakpoint

CREATE TABLE "client_note_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" uuid NOT NULL REFERENCES "client_notes"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "text" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "client_note_revisions_note_idx" ON "client_note_revisions" ("note_id");
--> statement-breakpoint

CREATE TABLE "booking_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "booking_documents_booking_idx" ON "booking_documents" ("booking_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_documents_file_name_unique" ON "booking_documents" ("file_name");
--> statement-breakpoint

INSERT INTO "permissions" ("key", "description") VALUES
  ('sales_channels.manage', 'Управление каналами продаж'),
  ('expense_categories.manage', 'Управление статьями расходов'),
  ('expenses.read', 'Просмотр расходов'),
  ('expenses.write', 'Изменение расходов'),
  ('client_notes.read', 'Просмотр внутренних заметок клиентов'),
  ('client_notes.write', 'Изменение внутренних заметок клиентов'),
  ('exports.read', 'Экспорт данных CRM')
ON CONFLICT ("key") DO NOTHING;
