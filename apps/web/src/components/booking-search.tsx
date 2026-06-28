"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BookingSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams({ checkIn, checkOut, guests });
    router.push(`/domiki?${params}`);
  };
  return (
    <form className={compact ? "form-stack" : "booking-form"} onSubmit={submit}>
      <div className="field"><label htmlFor={`check-in-${compact}`}>Заезд</label><input id={`check-in-${compact}`} type="date" required value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></div>
      <div className="field"><label htmlFor={`check-out-${compact}`}>Выезд</label><input id={`check-out-${compact}`} type="date" required min={checkIn} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></div>
      <div className="field"><label htmlFor={`guests-${compact}`}>Гости</label><select id={`guests-${compact}`} value={guests} onChange={(event) => setGuests(event.target.value)}><option value="1">1 гость</option><option value="2">2 гостя</option><option value="3">3 гостя</option><option value="4">4 гостя</option><option value="6">5–6 гостей</option></select></div>
      <button className="button button-primary" type="submit">Проверить даты</button>
    </form>
  );
}
