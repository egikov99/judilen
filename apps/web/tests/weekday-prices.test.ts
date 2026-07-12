import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { houseSchema } from "@/lib/validation";
import {
  calculateStayTotal,
  uniformWeekdayPrices,
  weekdayPriceRange,
  type WeekdayPrices
} from "@/lib/weekday-prices";

const validHouse = {
  slug: "test-house",
  name: "Тестовый дом",
  shortDescription: "Краткое описание тестового домика.",
  description: "Полное описание тестового домика для проверки тарифов по дням недели.",
  guests: 4,
  rooms: 2,
  amenities: ["Wi-Fi"],
  seoTitle: "Тестовый домик с тарифами по дням",
  seoDescription: "Описание тестового домика с отдельными тарифами для каждого дня недели.",
  isPublished: true
};

describe("house weekday prices", () => {
  it("supports the same required positive price for all seven days", () => {
    const weekdayPrices = uniformWeekdayPrices(350);
    expect(houseSchema.safeParse({ ...validHouse, weekdayPrices }).success).toBe(true);
    expect(weekdayPriceRange(weekdayPrices)).toEqual({ minPrice: 350, maxPrice: 350 });
    expect(Object.keys(weekdayPrices)).toHaveLength(7);
  });

  it("supports different weekday and weekend prices and editing one day", () => {
    const weekdayPrices: WeekdayPrices = {
      monday: 350,
      tuesday: 350,
      wednesday: 350,
      thursday: 350,
      friday: 500,
      saturday: 600,
      sunday: 450
    };
    expect(houseSchema.safeParse({ ...validHouse, weekdayPrices }).success).toBe(true);
    expect(weekdayPriceRange(weekdayPrices)).toEqual({ minPrice: 350, maxPrice: 600 });
    expect(weekdayPriceRange({ ...weekdayPrices, tuesday: 425 })).toEqual({ minPrice: 350, maxPrice: 600 });
  });

  it("rejects zero, negative, and incomplete weekday prices", () => {
    expect(houseSchema.safeParse({ ...validHouse, weekdayPrices: { ...uniformWeekdayPrices(350), sunday: 0 } }).success).toBe(false);
    expect(houseSchema.safeParse({ ...validHouse, weekdayPrices: { ...uniformWeekdayPrices(350), friday: -1 } }).success).toBe(false);
    const incomplete: Partial<WeekdayPrices> = uniformWeekdayPrices(350);
    delete incomplete.sunday;
    expect(houseSchema.safeParse({ ...validHouse, weekdayPrices: incomplete }).success).toBe(false);
  });

  it("calculates Friday through Sunday as Friday plus Saturday", () => {
    const prices = {
      ...uniformWeekdayPrices(350),
      friday: 500,
      saturday: 600
    };
    const stay = calculateStayTotal("2026-07-03", "2026-07-05", prices);
    expect(stay.total).toBe(1100);
    expect(stay.breakdown).toEqual([
      { date: "2026-07-03", weekday: "friday", price: 500 },
      { date: "2026-07-04", weekday: "saturday", price: 600 }
    ]);
  });

  it("backfills old houses and snapshots nightly prices for new bookings", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../packages/db/migrations/0015_house_weekday_prices.sql"), "utf8");
    const bookingRoute = readFileSync(resolve(process.cwd(), "src/app/api/bookings/route.ts"), "utf8");
    expect(migration).toContain('CROSS JOIN');
    expect(migration).toContain('"houses"."base_price"');
    expect(migration).toContain("booking_nightly_prices");
    expect(bookingRoute).toContain("calculateStayTotal");
    expect(bookingRoute).toContain("bookingNightlyPrices");
  });

  it("renders one price or a range in house cards", () => {
    const card = readFileSync(resolve(process.cwd(), "src/components/house-card.tsx"), "utf8");
    expect(card).toContain("house.minPrice === house.maxPrice");
    expect(card).toContain("до");
    expect(card).toContain("/ ночь");
  });

  it("keeps booking totals but removes public weekday price listing from house details", () => {
    const details = readFileSync(resolve(process.cwd(), "src/app/domiki/[slug]/page.tsx"), "utf8");
    const bookingCard = readFileSync(resolve(process.cwd(), "src/components/house-booking-card.tsx"), "utf8");
    expect(details).not.toContain("public-weekday-prices");
    expect(details).not.toContain("Цены по дням недели");
    expect(details).toContain("house-detail-price");
    expect(bookingCard).toContain("calculateStayTotal");
    expect(bookingCard).toContain("booking-price-breakdown");
  });
});
