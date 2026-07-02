CREATE TABLE "communication_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider" text NOT NULL,
  "name" text NOT NULL,
  "is_enabled" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'disconnected',
  "public_config" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "secret_config_encrypted" text,
  "webhook_secret" text NOT NULL,
  "last_checked_at" timestamptz,
  "last_message_at" timestamptz,
  "last_error" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "communication_channels_provider_check"
    CHECK ("provider" IN ('telegram', 'telegram_group', 'vk', 'instagram', 'whatsapp', 'viber')),
  CONSTRAINT "communication_channels_status_check"
    CHECK ("status" IN ('connected', 'disconnected', 'error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "communication_channels_provider_unique"
  ON "communication_channels" ("provider");
--> statement-breakpoint
CREATE UNIQUE INDEX "communication_channels_webhook_secret_unique"
  ON "communication_channels" ("webhook_secret");
--> statement-breakpoint

CREATE TABLE "chat_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id" uuid NOT NULL REFERENCES "communication_channels"("id") ON DELETE CASCADE,
  "external_chat_id" text NOT NULL,
  "external_user_id" text,
  "display_name" text NOT NULL,
  "avatar_url" text,
  "is_group" boolean NOT NULL DEFAULT false,
  "unread_count" integer NOT NULL DEFAULT 0 CHECK ("unread_count" >= 0),
  "last_message_at" timestamptz,
  "last_message_preview" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_channel_external_unique"
  ON "chat_conversations" ("channel_id", "external_chat_id");
--> statement-breakpoint
CREATE INDEX "chat_conversations_last_message_idx"
  ON "chat_conversations" ("last_message_at");
--> statement-breakpoint

CREATE TABLE "chat_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  "external_message_id" text,
  "direction" text NOT NULL,
  "sender_name" text,
  "body" text NOT NULL,
  "status" text NOT NULL,
  "sent_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "raw_payload" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chat_messages_direction_check"
    CHECK ("direction" IN ('inbound', 'outbound', 'system')),
  CONSTRAINT "chat_messages_status_check"
    CHECK ("status" IN ('received', 'pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_conversation_external_unique"
  ON "chat_messages" ("conversation_id", "external_message_id");
--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_created_idx"
  ON "chat_messages" ("conversation_id", "created_at");
--> statement-breakpoint

INSERT INTO "permissions" ("key", "description")
VALUES
  ('chats.read', 'Просмотр чатов'),
  ('chats.write', 'Ответы в чатах')
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.key = 'chats.read'
WHERE r.name IN ('super_admin', 'admin', 'manager', 'viewer')
ON CONFLICT DO NOTHING;
--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.key = 'chats.write'
WHERE r.name IN ('super_admin', 'admin', 'manager')
ON CONFLICT DO NOTHING;
