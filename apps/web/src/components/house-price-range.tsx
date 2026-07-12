import { formatPrice } from "@/lib/catalog";
import { normalizeHousePriceRange, type HousePriceRange } from "@/lib/house-price-range";

function PriceAmount({ amount }: { amount: number }) {
  return <span className="price-currency currency-value"><data className="price-value" value={String(amount)}>{formatPrice(amount)}</data><i className="nbrb-icon" aria-hidden="true">&#x183;</i><span className="visually-hidden">BYN</span></span>;
}

export function HousePriceRangeText({ range }: { range: HousePriceRange }) {
  const normalized = normalizeHousePriceRange(range);
  if (!normalized?.minPrice) return null;
  if (!normalized.maxPrice || normalized.minPrice === normalized.maxPrice) {
    return <><span className="price-prefix">от</span> <PriceAmount amount={normalized.minPrice} /> <span className="price-period">/ ночь</span></>;
  }
  return <><span className="price-prefix">от</span> <PriceAmount amount={normalized.minPrice} /> <span className="price-separator">до</span> <PriceAmount amount={normalized.maxPrice} /> <span className="price-period">/ ночь</span></>;
}
