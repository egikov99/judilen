import { formatPrice } from "@/lib/catalog";

export function formatCurrency(amount: number, currency = "BYN") {
  const formatted = formatPrice(amount);

  if (currency !== "BYN") {
    return <span>{formatted} {currency}</span>;
  }

  return (
    <span className="currency-value">
      {formatted}
      <i className="nbrb-icon" aria-hidden="true">&#x183;</i>
      <span className="visually-hidden">BYN</span>
    </span>
  );
}
