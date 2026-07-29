import { roundMoney } from "./weekday-prices";

export type ServicePricingInput = {
  unitPrice: number;
  quantity: number;
  priceUnit: string;
  minRentalHours: number | null;
  extensionPrice: number | null;
};

export function calculateServiceLineTotal({
  unitPrice,
  quantity,
  priceUnit,
  minRentalHours,
  extensionPrice
}: ServicePricingInput) {
  if (priceUnit === "hour" && minRentalHours !== null) {
    const extensionHours = Math.max(0, quantity - minRentalHours);
    return roundMoney(unitPrice + extensionHours * (extensionPrice ?? 0));
  }
  return roundMoney(unitPrice * quantity);
}
