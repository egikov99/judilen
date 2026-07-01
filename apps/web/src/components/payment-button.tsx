"use client";

import { useState } from "react";
import { formatCurrency } from "@/components/currency";

export function PaymentButton({ bookingId, amount }: { bookingId: string; amount: number }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function pay() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId })
    });
    const payload = await response.json();
    if (!response.ok) {
      setLoading(false);
      return setError(payload.detail ?? payload.title ?? "Платеж недоступен");
    }
    window.location.assign(payload.confirmationUrl);
  }
  return <>{error && <div className="notice error">{error}</div>}<button className="button button-primary" onClick={pay} disabled={loading}>{loading ? "Переходим к оплате…" : <>Оплатить {formatCurrency(amount)}</>}</button></>;
}
