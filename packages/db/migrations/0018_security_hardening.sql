CREATE TABLE "security_rate_limits" (
  "key_hash" text PRIMARY KEY,
  "window_started_at" timestamptz NOT NULL,
  "request_count" integer NOT NULL DEFAULT 1,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "security_rate_limits_updated_idx"
  ON "security_rate_limits" ("updated_at");
