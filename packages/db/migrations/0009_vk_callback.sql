CREATE TABLE "vk_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "communication_channel_id" uuid REFERENCES "communication_channels"("id") ON DELETE SET NULL,
  "group_id" text NOT NULL,
  "group_name" text,
  "api_version" text NOT NULL DEFAULT '5.199',
  "callback_url" text NOT NULL,
  "confirmation_token" text NOT NULL,
  "secret_key" text NOT NULL,
  "access_token" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "last_confirmed_at" timestamptz,
  "last_event_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "vk_integrations_status_check"
    CHECK ("status" IN ('not_configured', 'pending', 'connected', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "vk_integrations_group_unique" ON "vk_integrations" ("group_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "vk_integrations_channel_unique" ON "vk_integrations" ("communication_channel_id");
--> statement-breakpoint
CREATE TABLE "vk_events_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" uuid NOT NULL REFERENCES "vk_integrations"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL,
  "event_type" text NOT NULL,
  "event_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL,
  "error_message" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "vk_events_log_event_unique"
  ON "vk_events_log" ("integration_id", "event_id");
--> statement-breakpoint
CREATE INDEX "vk_events_log_integration_created_idx"
  ON "vk_events_log" ("integration_id", "created_at");
