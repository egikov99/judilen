"use client";

import { useState } from "react";
import { formatCurrency, type House } from "@/lib/catalog";
import { priceUnitLabels, type PublicService } from "@/lib/service-types";

export function HouseBookingCard({ house, services }: { house: House; services: PublicService[] }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Record<string, { enabled: boolean; optionId: string; quantity: number }>>({});
  const [dates, setDates] = useState({ checkIn: "", checkOut: "" });
  const nights = dates.checkIn && dates.checkOut ? Math.max(0, Math.ceil((Date.parse(dates.checkOut) - Date.parse(dates.checkIn)) / 86_400_000)) : 0;
  const servicesTotal = services.reduce((sum, service) => {
    const state = selected[service.id];
    if (!state?.enabled) return sum;
    const option = service.options.find((item) => item.id === state.optionId) ?? service.options.find((item) => item.isDefault) ?? service.options[0];
    return sum + (option?.price ?? service.basePrice) * state.quantity;
  }, 0);
  const total = nights * house.price + servicesTotal;

  function serviceSelection(service: PublicService) {
    return selected[service.id] ?? {
      enabled: false,
      optionId: service.options.find((item) => item.isDefault)?.id ?? service.options[0]?.id ?? "",
      quantity: 1
    };
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const selectedServices = services.map((service) => {
      const item = serviceSelection(service);
      return item.enabled ? { serviceId: service.id, serviceOptionId: item.optionId || null, quantity: item.quantity } : null;
    }).filter((item) => item !== null);
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, houseId: house.id, guests: Number(data.guests), consent: data.consent === "on", services: selectedServices })
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
      <span className="eyebrow">от {formatCurrency(house.price)} / ночь</span>
      <h2 style={{ fontFamily: "var(--serif)", marginBottom: 4 }}>Запросить бронирование</h2>
      <form onSubmit={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="checkIn">Заезд</label><input id="checkIn" name="checkIn" type="date" required onChange={(event) => setDates((value) => ({ ...value, checkIn: event.target.value }))} /></div>
          <div className="field"><label htmlFor="checkOut">Выезд</label><input id="checkOut" name="checkOut" type="date" required onChange={(event) => setDates((value) => ({ ...value, checkOut: event.target.value }))} /></div>
        </div>
        <div className="field"><label htmlFor="guests">Гости</label><select id="guests" name="guests" defaultValue="2"><option value="1">1 гость</option><option value="2">2 гостя</option><option value="3">3 гостя</option><option value="4">4 гостя</option></select></div>
        <div className="form-grid">
          <div className="field"><label htmlFor="firstName">Имя</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div>
          <div className="field"><label htmlFor="lastName">Фамилия</label><input id="lastName" name="lastName" autoComplete="family-name" /></div>
        </div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
        <div className="field"><label htmlFor="phone">Телефон</label><input id="phone" name="phone" type="tel" autoComplete="tel" required /></div>
        {!!services.length && <div className="form-stack" style={{ marginTop: 18 }}>
          <strong>Дополнительные услуги</strong>
          {services.map((service) => {
            const item = serviceSelection(service);
            const option = service.options.find((current) => current.id === item.optionId) ?? service.options[0];
            return <div className="notice" key={service.id} style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "flex", gap: 9 }}><input type="checkbox" checked={item.enabled} onChange={(event) => setSelected((value) => ({ ...value, [service.id]: { ...item, enabled: event.target.checked } }))} /> {service.title}</label>
              <div className="form-grid">
                <div className="field"><label htmlFor={`option-${service.id}`}>Вариант</label><select id={`option-${service.id}`} value={item.optionId} disabled={!item.enabled || !service.options.length} onChange={(event) => setSelected((value) => ({ ...value, [service.id]: { ...item, optionId: event.target.value } }))}>{service.options.map((current) => <option key={current.id} value={current.id}>{current.title} - {formatCurrency(current.price)}</option>)}</select></div>
                <div className="field"><label htmlFor={`quantity-${service.id}`}>Количество</label><input id={`quantity-${service.id}`} type="number" min="1" max="100" value={item.quantity} disabled={!item.enabled} onChange={(event) => setSelected((value) => ({ ...value, [service.id]: { ...item, quantity: Number(event.target.value) || 1 } }))} /></div>
              </div>
              <small>{formatCurrency(option?.price ?? service.basePrice)} {priceUnitLabels[service.priceUnit]}</small>
            </div>;
          })}
        </div>}
        <div className="summary-row"><span>Итого</span><strong>{total > 0 ? formatCurrency(total) : "Выберите даты"}</strong></div>
        <label style={{ display: "flex", gap: 9, marginTop: 16, fontSize: 12 }}><input name="consent" type="checkbox" required /> Согласен с политикой конфиденциальности</label>
        <button className="button button-primary" disabled={state === "loading"}>{state === "loading" ? "Отправляем…" : "Отправить заявку"}</button>
      </form>
      {message && <p className={`notice ${state === "error" ? "error" : ""}`} role="status">{message}</p>}
    </aside>
  );
}
