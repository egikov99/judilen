ALTER TABLE "chat_conversations"
  ADD COLUMN "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  ADD COLUMN "status" text NOT NULL DEFAULT 'open';
--> statement-breakpoint
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_status_check"
  CHECK ("status" IN ('open', 'closed', 'archived'));
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_conversations_channel_user_unique"
  ON "chat_conversations" ("channel_id", "user_id")
  WHERE "user_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_messages"
  ADD COLUMN "read_at" timestamptz;
--> statement-breakpoint
CREATE TABLE "website_chat_visitors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "chat_conversations"("id") ON DELETE CASCADE,
  "visitor_hash" text NOT NULL,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "website_chat_visitors_hash_unique"
  ON "website_chat_visitors" ("visitor_hash");
--> statement-breakpoint
CREATE INDEX "website_chat_visitors_conversation_idx"
  ON "website_chat_visitors" ("conversation_id");
