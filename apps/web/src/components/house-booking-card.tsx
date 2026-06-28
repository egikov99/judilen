"use client";

import { useState } from "react";
import { formatPrice, type House } from "@/lib/catalog";

export function HouseBookingCard({ house }: { house: House }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, houseId: house.id, guests: Number(data.guests), consent: data.consent === "on" })
    });
    const payload = await response.json();
    if (!response.ok) {
      setState("error");
      setMessage(payload.detail ?? payload.title ?? "Не удалось отправить заявку");
      return;
    }
    setState("success");
    setMessage(`Заявка ${payload.publicNumber} создана. Мы свяжемся с вами для подтверждения.`);
    event.currentTarget.reset();
  }
  return (
    <aside className="booking-card">
      <span className="eyebrow">от {formatPrice(house.price)} ₽ / ночь</span>
      <h2 style={{ fontFamily: "var(--serif)", marginBottom: 4 }}>Запросить бронирование</h2>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="checkIn">Заезд</label><input id="checkIn" name="checkIn" type="date" required /></div>
          <div className="field"><label htmlFor="checkOut">Выезд</label><input id="checkOut" name="checkOut" type="date" required /></div>
        </div>
        <div className="field"><label htmlFor="guests">Гости</label><select id="guests" name="guests" defaultValue="2"><option value="1">1 гость</option><option value="2">2 гостя</option><option value="3">3 гостя</option><option value="4">4 гостя</option></select></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="firstName">Имя</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div>
          <div className="field"><label htmlFor="lastName">Фамилия</label><input id="lastName" name="lastName" autoComplete="family-name" /></div>
        </div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="phone">Телефон</label><input id="phone" name="phone" type="tel" autoComplete="tel" required /></div>
        <label style={{ display: "flex", gap: 9, marginTop: 16, fontSize: 12 }}><input name="consent" type="checkbox" required /> Согласен с политикой конфиденциальности</label>
        <button className="button button-primary" disabled={state === "loading"}>{state === "loading" ? "Отправляем…" : "Отправить заявку"}</button>
      </form>
      {message && <p className={`notice ${state === "error" ? "error" : ""}`} role="status">{message}</p>}
    </aside>
  );
}

