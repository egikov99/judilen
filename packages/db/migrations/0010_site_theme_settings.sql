CREATE TABLE "site_theme_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "primary_color" text NOT NULL,
  "button_color" text NOT NULL,
  "button_hover_color" text NOT NULL,
  "background_color" text NOT NULL,
  "card_color" text NOT NULL,
  "text_color" text NOT NULL,
  "accent_color" text NOT NULL,
  "header_color" text NOT NULL,
  "footer_color" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
