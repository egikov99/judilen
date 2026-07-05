import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { houseSchema } from "@/lib/validation";
import { uniformWeekdayPrices } from "@/lib/weekday-prices";

const validHouse = {
  slug: "badge-house",
  name: "Дом с бейджем",
  shortDescription: "Краткое описание домика с управляемым бейджем.",
  description: "Полное описание домика для проверки управляемого текста бейджа карточки.",
  guests: 4,
  rooms: 2,
  amenities: ["Wi-Fi"],
  weekdayPrices: uniformWeekdayPrices(350),
  seoTitle: "Домик с управляемым бейджем карточки",
  seoDescription: "Описание тестового домика с управляемым бейджем для публичной карточки.",
  isPublished: true
};

describe("house card badge", () => {
  it("accepts custom and empty badge values", () => {
    expect(houseSchema.safeParse({ ...validHouse, badgeText: "Флагманский дом" }).success).toBe(true);
    expect(houseSchema.safeParse({ ...validHouse, badgeText: "Для семьи" }).success).toBe(true);
    expect(houseSchema.safeParse({ ...validHouse, badgeText: null }).success).toBe(true);
    expect(houseSchema.safeParse({ ...validHouse, badgeText: "" }).success).toBe(true);
  });

  it("rejects an excessively long badge", () => {
    expect(houseSchema.safeParse({ ...validHouse, badgeText: "а".repeat(81) }).success).toBe(false);
  });

  it("renders only a non-empty badge from house data", () => {
    const card = readFileSync(resolve(process.cwd(), "src/components/house-card.tsx"), "utf8");
    const loader = readFileSync(resolve(process.cwd(), "src/lib/houses.ts"), "utf8");
    expect(card).toContain("house.badgeText &&");
    expect(card).toContain("{house.badgeText}");
    expect(loader).toContain("badgeText: house.badgeText");
    expect(loader).not.toContain("function eyebrow");
  });

  it("supports editing and clearing through the admin API", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/components/admin/house-editor.tsx"), "utf8");
    const createRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/houses/route.ts"), "utf8");
    const updateRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/houses/[id]/route.ts"), "utf8");
    expect(editor).toContain("Бейдж карточки");
    expect(editor).toContain("Например: Флагманский дом");
    expect(createRoute).toContain("badgeText: badgeText?.trim() || null");
    expect(updateRoute).toContain("badgeText: badgeText?.trim() || null");
  });

  it("adds a nullable column and preserves previous labels during migration", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../packages/db/migrations/0019_house_badge.sql"), "utf8");
    expect(migration).toContain('ADD COLUMN "badge_text" text');
    expect(migration).toContain('UPDATE "houses"');
  });
});
