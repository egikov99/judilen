"use client";

import { useState } from "react";

const labels = {
  new: "Новая заявка",
  awaiting_confirmation: "Ожидает подтверждения",
  confirmed: "Подтверждено",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачено",
  cancelled: "Отменено",
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
  return <select value={value} disabled={saving} onChange={(event) => change(event.target.value as keyof typeof labels)} aria-label="Статус бронирования">{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>;
}

