ALTER TABLE "chat_attachments" ALTER COLUMN "file_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ALTER COLUMN "mime_type" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ALTER COLUMN "storage_path" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "title" text;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "description" text;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "external_url" text;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "preview_url" text;
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD COLUMN "metadata" jsonb;
--> statement-breakpoint
ALTER TABLE "chat_attachments" DROP CONSTRAINT "chat_attachments_kind_check";
--> statement-breakpoint
ALTER TABLE "chat_attachments" ADD CONSTRAINT "chat_attachments_kind_check" CHECK ("kind" IN ('image', 'file', 'market'));
