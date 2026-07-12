import { formatCurrency } from "@/components/currency";
import { normalizeHousePriceRange, type HousePriceRange } from "@/lib/house-price-range";

export function HousePriceRangeText({ range }: { range: HousePriceRange }) {
  const normalized = normalizeHousePriceRange(range);
  if (!normalized?.minPrice) return null;
  if (!normalized.maxPrice || normalized.minPrice === normalized.maxPrice) {
    return <>от {formatCurrency(normalized.minPrice)} / ночь</>;
  }
  return <>от {formatCurrency(normalized.minPrice)} до {formatCurrency(normalized.maxPrice)} / ночь</>;
}
