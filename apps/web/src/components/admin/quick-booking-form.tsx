"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { formatCurrency } from "@/components/currency";
import type { PublicService } from "@/lib/service-types";

export function QuickBookingForm({ houses, channels, services, defaults, initiallyOpen = false }: {
  houses: Array<{ id: string; name: string; guests: number }>;
  channels: Array<{ id: string; name: string }>;
  services: PublicService[];
  defaults: { houseId: string; checkIn: string; checkOut: string };
  initiallyOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [message, setMessage] = useState("");
  const [houseId, setHouseId] = useState(defaults.houseId);
  const [selectedServices, setSelectedServices] = useState<Record<string, { enabled: boolean; optionId: string; quantity: number }>>({});
  const capacity = houses.find((house) => house.id === houseId)?.guests ?? 1;
  const availableServices = services.filter((service) => !service.houseIds.length || service.houseIds.includes(houseId));
  const servicesTotal = availableServices.reduce((sum, service) => {
    const selected = selectedServices[service.id];
    if (!selected?.enabled) return sum;
    const option = service.options.find((item) => item.id === selected.optionId) ?? service.options[0];
    return sum + (option?.price ?? service.basePrice) * selected.quantity;
  }, 0);
  function selection(service: PublicService) {
    return selectedServices[service.id] ?? {
      enabled: false,
      optionId: service.options.find((item) => item.isDefault)?.id ?? service.options[0]?.id ?? "",
      quantity: service.priceUnit === "hour" ? service.minRentalHours ?? 1 : 1
    };
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        houseId: form.get("houseId"), checkIn: form.get("checkIn"), checkOut: form.get("checkOut"),
        firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"),
        phone: form.get("phone"), guests: Number(form.get("guests")), totalAmount: Number(form.get("totalAmount")),
        status: form.get("status"), salesChannelId: form.get("salesChannelId") || null, managerComment: form.get("managerComment"),
        services: availableServices.flatMap((service) => {
          const item = selection(service);
          return item.enabled ? [{ serviceId: service.id, serviceOptionId: item.optionId || null, quantity: item.quantity }] : [];
        })
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось создать бронирование");
    setMessage("Бронирование создано");
    router.refresh();
  }
  return <section className="manual-booking">
    <button className="button button-primary" type="button" onClick={() => setOpen((value) => !value)}>{open ? "Закрыть форму" : "Добавить бронирование"}</button>
    {open && <div className="panel" style={{ marginTop: 16 }}><h2>Новое бронирование</h2>{message && <p className="notice">{message}</p>}<form className="form-stack" onSubmit={submit}>
    <div className="form-grid"><div className="field"><label>Домик</label><select name="houseId" value={houseId} onChange={(event) => setHouseId(event.target.value)}>{houses.map((house) => <option value={house.id} key={house.id}>{house.name} (до {house.guests} чел.)</option>)}</select></div><div className="field"><label>Канал продаж</label><select name="salesChannelId"><option value="">Не указан</option>{channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></div><div className="field"><label>Статус</label><select name="status"><option value="confirmed">Подтверждено</option><option value="blocked">Блокировка дат</option></select></div></div>
    <div className="form-grid"><div className="field"><label>Заезд</label><input name="checkIn" type="date" defaultValue={defaults.checkIn} required /></div><div className="field"><label>Выезд</label><input name="checkOut" type="date" defaultValue={defaults.checkOut} required /></div></div>
    <div className="form-grid"><div className="field"><label>Имя</label><input name="firstName" required /></div><div className="field"><label>Фамилия</label><input name="lastName" /></div></div>
    <div className="form-grid"><div className="field"><label>Email</label><input name="email" type="email" required /></div><div className="field"><label>Телефон</label><input name="phone" required /></div></div>
    <div className="form-grid"><div className="field"><label>Гостей (максимум {capacity})</label><select name="guests" defaultValue="1">{Array.from({ length: capacity }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count}</option>)}</select></div><div className="field"><label>Стоимость проживания</label><input name="totalAmount" type="number" min="0" step="0.01" defaultValue="0" required /></div></div>
    {!!availableServices.length && <section className="form-stack"><strong>Дополнительные услуги</strong>{availableServices.map((service) => { const item = selection(service); const option = service.options.find((current) => current.id === item.optionId) ?? service.options[0]; return <div className="notice" key={service.id}><label><input type="checkbox" checked={item.enabled} onChange={(event) => setSelectedServices((current) => ({ ...current, [service.id]: { ...item, enabled: event.target.checked } }))} /> {service.title}</label><div className="form-grid">{!!service.options.length && <div className="field"><label>Вариант</label><select value={item.optionId} disabled={!item.enabled} onChange={(event) => setSelectedServices((current) => ({ ...current, [service.id]: { ...item, optionId: event.target.value } }))}>{service.options.map((current) => <option key={current.id} value={current.id}>{current.title}</option>)}</select></div>}<div className="field"><label>{service.priceUnit === "hour" ? "Часы" : "Количество"}</label><input type="number" min={service.priceUnit === "hour" ? service.minRentalHours ?? 1 : 1} max="100" value={item.quantity} disabled={!item.enabled} onChange={(event) => setSelectedServices((current) => ({ ...current, [service.id]: { ...item, quantity: Number(event.target.value) || 1 } }))} /></div></div><small>{formatCurrency(option?.price ?? service.basePrice)} за единицу</small></div>; })}<div className="summary-row"><span>Итого по услугам</span><strong>{formatCurrency(servicesTotal)}</strong></div></section>}
    <div className="field"><label>Комментарий</label><textarea name="managerComment" /></div>
    <button className="button button-primary">Создать бронирование</button>
  </form></div>}
  </section>;
}
