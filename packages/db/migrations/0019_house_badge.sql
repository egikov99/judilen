ALTER TABLE "houses" ADD COLUMN "badge_text" text;

-- Preserve the labels previously calculated by the public frontend. From now on
-- these values are regular editable data and are never inferred at runtime.
UPDATE "houses"
SET "badge_text" = CASE
  WHEN "guests" <= 2 THEN 'Для двоих'
  WHEN "guests" >= 6 THEN 'Для семьи'
  ELSE 'Флагманский дом'
END;
