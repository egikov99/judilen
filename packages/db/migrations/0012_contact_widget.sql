CREATE TABLE "contact_widget_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_type" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "display_name" text NOT NULL,
  "subtitle" text,
  "url" text,
  "phone" text,
  "username" text,
  "default_message" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "icon" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "contact_widget_settings_channel_unique"
  ON "contact_widget_settings" ("channel_type");
--> statement-breakpoint
INSERT INTO "contact_widget_settings"
  ("channel_type", "display_name", "subtitle", "sort_order", "icon")
VALUES
  ('telegram', 'Telegram', 'Написать в Telegram', 10, 'telegram'),
  ('viber', 'Viber', 'Написать в Viber', 20, 'viber'),
  ('whatsapp', 'WhatsApp', 'Написать в WhatsApp', 30, 'whatsapp'),
  ('instagram', 'Instagram', 'Открыть Instagram', 40, 'instagram'),
  ('website', 'Чат на сайте', 'Напишите нам', 50, 'message-circle')
ON CONFLICT ("channel_type") DO NOTHING;
--> statement-breakpoint
INSERT INTO "communication_channels"
  ("provider", "name", "is_enabled", "status", "public_config", "webhook_secret")
VALUES
  ('website', 'Чат на сайте', true, 'connected', '{}'::jsonb, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT ("provider") DO NOTHING;
