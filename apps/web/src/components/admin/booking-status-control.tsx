"use client";

import { useState } from "react";

const labels = {
  new: "Новая заявка",
  pending: "Ожидает обработки",
  awaiting_confirmation: "Ожидает подтверждения",
  confirmed: "Подтверждено",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачено",
  external: "Внешнее бронирование",
  blocked: "Блокировка дат",
  cancelled: "Отменено",
  declined: "Отклонено",
  import_removed: "Удалено из импорта",
  completed: "Завершено"
} as const;

export function BookingStatusControl({ id, status }: { id: string; status: keyof typeof labels }) {
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  async function change(next: keyof typeof labels) {
    setSaving(true);
    const response = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next })
    });
    setSaving(false);
    if (response.ok) setValue(next);
  }
  return <div className="booking-status-control"><select value={value} disabled={saving} onChange={(event) => change(event.target.value as keyof typeof labels)} aria-label="Статус бронирования">{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><small>{value === "paid" ? "Оплата получена" : "Оплата по приезду · не оплачено"}</small></div>;
}
