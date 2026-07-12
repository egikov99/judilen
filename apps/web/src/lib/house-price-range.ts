import { formatCurrency } from "@/lib/catalog";

export interface HousePriceRange {
  minPrice: number | null;
  maxPrice: number | null;
}

function validPrice(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function normalizeHousePriceRange(range: HousePriceRange): HousePriceRange | null {
  const minPrice = validPrice(range.minPrice) ? range.minPrice : null;
  const maxPrice = validPrice(range.maxPrice) ? range.maxPrice : null;
  if (minPrice === null && maxPrice === null) return null;
  return { minPrice: minPrice ?? maxPrice, maxPrice };
}

export function formatHousePriceRange(range: HousePriceRange) {
  const normalized = normalizeHousePriceRange(range);
  if (!normalized?.minPrice) return null;
  if (!normalized.maxPrice || normalized.minPrice === normalized.maxPrice) {
    return `от ${formatCurrency(normalized.minPrice)} / ночь`;
  }
  return `от ${formatCurrency(normalized.minPrice)} до ${formatCurrency(normalized.maxPrice)} / ночь`;
}
