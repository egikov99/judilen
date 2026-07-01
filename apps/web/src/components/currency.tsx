import { formatPrice } from "@/lib/catalog";

export function formatCurrency(amount: number, currency = "BYN") {
  const formatted = formatPrice(amount);

  if (currency !== "BYN") {
    return <span>{formatted} {currency}</span>;
  }

  return (
    <span className="currency-value">
      {formatted}
      <i className="nbrb-icon nbrb-icon-byn" aria-hidden="true" />
      <span className="visually-hidden">BYN</span>
    </span>
  );
}
