CREATE TABLE "chat_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "chat_messages"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer,
  "storage_path" text NOT NULL,
  "external_file_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "chat_attachments_kind_check" CHECK ("kind" IN ('image', 'file'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_attachments_message_external_unique"
  ON "chat_attachments" ("message_id", "external_file_id");
--> statement-breakpoint
CREATE INDEX "chat_attachments_message_idx"
  ON "chat_attachments" ("message_id");
