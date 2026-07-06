"use client";

import { useState } from "react";

export function BookingSalesChannelControl({ bookingId, value, channels }: {
  bookingId: string;
  value: string | null;
  channels: Array<{ id: string; name: string }>;
}) {
  const [current, setCurrent] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  async function change(next: string) {
    setSaving(true);
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesChannelId: next || null })
    });
    if (response.ok) setCurrent(next);
    setSaving(false);
  }
  return <select aria-label="Канал продаж" value={current} disabled={saving} onChange={(event) => change(event.target.value)}><option value="">Не указан</option>{channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select>;
}
