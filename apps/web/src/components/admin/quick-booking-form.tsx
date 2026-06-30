"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function QuickBookingForm({ houses, defaults, initiallyOpen = false }: {
  houses: Array<{ id: string; name: string }>;
  defaults: { houseId: string; checkIn: string; checkOut: string };
  initiallyOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        houseId: form.get("houseId"), checkIn: form.get("checkIn"), checkOut: form.get("checkOut"),
        firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"),
        phone: form.get("phone"), guests: Number(form.get("guests")), totalAmount: Number(form.get("totalAmount")),
        status: form.get("status"), managerComment: form.get("managerComment")
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
    <div className="form-grid"><div className="field"><label>Домик</label><select name="houseId" defaultValue={defaults.houseId}>{houses.map((house) => <option value={house.id} key={house.id}>{house.name}</option>)}</select></div><div className="field"><label>Статус</label><select name="status"><option value="confirmed">Подтверждено</option><option value="blocked">Блокировка дат</option></select></div></div>
    <div className="form-grid"><div className="field"><label>Заезд</label><input name="checkIn" type="date" defaultValue={defaults.checkIn} required /></div><div className="field"><label>Выезд</label><input name="checkOut" type="date" defaultValue={defaults.checkOut} required /></div></div>
    <div className="form-grid"><div className="field"><label>Имя</label><input name="firstName" required /></div><div className="field"><label>Фамилия</label><input name="lastName" /></div></div>
    <div className="form-grid"><div className="field"><label>Email</label><input name="email" type="email" required /></div><div className="field"><label>Телефон</label><input name="phone" required /></div></div>
    <div className="form-grid"><div className="field"><label>Гостей</label><input name="guests" type="number" min="1" defaultValue="1" required /></div><div className="field"><label>Сумма</label><input name="totalAmount" type="number" min="0" defaultValue="0" required /></div></div>
    <div className="field"><label>Комментарий</label><textarea name="managerComment" /></div>
    <button className="button button-primary">Создать бронирование</button>
  </form></div>}
  </section>;
}
