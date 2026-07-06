"use client";

import { useState } from "react";

type Tab = "general" | "bookings" | "notes";

export function CustomerTabs({ general, bookings, notes }: {
  general: React.ReactNode;
  bookings: React.ReactNode;
  notes?: React.ReactNode;
}) {
  const [active, setActive] = useState<Tab>("general");
  return <div className="customer-tabs">
    <div className="settings-navigation" role="tablist" aria-label="Карточка клиента">
      <button className={active === "general" ? "is-active" : ""} role="tab" aria-selected={active === "general"} type="button" onClick={() => setActive("general")}>Общая информация</button>
      <button className={active === "bookings" ? "is-active" : ""} role="tab" aria-selected={active === "bookings"} type="button" onClick={() => setActive("bookings")}>История бронирований</button>
      {notes && <button className={active === "notes" ? "is-active" : ""} role="tab" aria-selected={active === "notes"} type="button" onClick={() => setActive("notes")}>Комментарии CRM</button>}
    </div>
    <div role="tabpanel">{active === "general" ? general : active === "bookings" ? bookings : notes}</div>
  </div>;
}
