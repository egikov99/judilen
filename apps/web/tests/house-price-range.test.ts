import { describe, expect, it } from "vitest";
import { formatHousePriceRange, normalizeHousePriceRange } from "@/lib/house-price-range";

describe("house price range formatting", () => {
  it("formats different min and max prices", () => {
    expect(formatHousePriceRange({ minPrice: 150, maxPrice: 300 })).toBe("от 150 BYN до 300 BYN / ночь");
  });

  it("formats equal min and max prices as one value", () => {
    expect(formatHousePriceRange({ minPrice: 150, maxPrice: 150 })).toBe("от 150 BYN / ночь");
  });

  it("formats a range with only minimum price", () => {
    expect(formatHousePriceRange({ minPrice: 150, maxPrice: null })).toBe("от 150 BYN / ночь");
  });

  it("returns null when there are no valid prices", () => {
    expect(formatHousePriceRange({ minPrice: null, maxPrice: null })).toBeNull();
    expect(formatHousePriceRange({ minPrice: 0, maxPrice: -1 })).toBeNull();
  });

  it("uses numeric fields from a returned range object", () => {
    const range = normalizeHousePriceRange({ minPrice: 150, maxPrice: 300 });
    expect(range).toEqual({ minPrice: 150, maxPrice: 300 });
    expect(formatHousePriceRange(range!)).toBe("от 150 BYN до 300 BYN / ночь");
  });
});
