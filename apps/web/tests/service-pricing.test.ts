import { describe, expect, it } from "vitest";
import { calculateServiceLineTotal } from "@/lib/service-pricing";
import { servicePriceUnitLabel } from "@/lib/service-types";

describe("service pricing", () => {
  it("charges the base price once for the minimum rental period", () => {
    expect(calculateServiceLineTotal({
      unitPrice: 80,
      quantity: 3,
      priceUnit: "hour",
      minRentalHours: 3,
      extensionPrice: 20
    })).toBe(80);
  });

  it("charges only the extension price for hours above the minimum", () => {
    expect(calculateServiceLineTotal({
      unitPrice: 80,
      quantity: 5,
      priceUnit: "hour",
      minRentalHours: 3,
      extensionPrice: 20
    })).toBe(120);
  });

  it("keeps quantity pricing for services without a minimum period", () => {
    expect(calculateServiceLineTotal({
      unitPrice: 15,
      quantity: 4,
      priceUnit: "hour",
      minRentalHours: null,
      extensionPrice: null
    })).toBe(60);
  });

  it("describes a base price with minimum hours as a package", () => {
    expect(servicePriceUnitLabel({ priceUnit: "hour", minRentalHours: 3 })).toBe("за 3 ч.");
  });
});
