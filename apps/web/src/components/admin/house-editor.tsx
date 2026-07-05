"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { weekdayLabels, weekdays, type Weekday, type WeekdayPrices } from "@/lib/weekday-prices";

interface HouseValue {
  id?: string;
  slug?: string;
  name?: string;
  shortDescription?: string;
  description?: string;
  guests?: number;
  rooms?: number;
  badgeText?: string | null;
  amenities?: string[];
  basePrice?: string;
  weekdayPrices?: WeekdayPrices;
  seoTitle?: string;
  seoDescription?: string;
  isPublished?: boolean;
}

export function HouseEditor({ value = {} }: { value?: HouseValue }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [weekdayPrices, setWeekdayPrices] = useState<Record<Weekday, string>>(() => Object.fromEntries(
    weekdays.map((weekday) => [weekday, String(value.weekdayPrices?.[weekday] ?? value.basePrice ?? "")])
  ) as Record<Weekday, string>);

  function copyMondayPrice() {
    const mondayPrice = weekdayPrices.monday;
    if (!mondayPrice) return;
    setWeekdayPrices(Object.fromEntries(weekdays.map((weekday) => [weekday, mondayPrice])) as Record<Weekday, string>);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      slug: form.get("slug"),
      name: form.get("name"),
      shortDescription: form.get("shortDescription"),
      description: form.get("description"),
      guests: Number(form.get("guests")),
      rooms: Number(form.get("rooms")),
      badgeText: String(form.get("badgeText") ?? "").trim() || null,
      amenities: String(form.get("amenities")).split(",").map((item) => item.trim()).filter(Boolean),
      weekdayPrices: Object.fromEntries(weekdays.map((weekday) => [weekday, Number(weekdayPrices[weekday])])),
      seoTitle: form.get("seoTitle"),
      seoDescription: form.get("seoDescription"),
      isPublished: form.get("isPublished") === "on"
    };
    const response = await fetch(value.id ? `/api/admin/houses/${value.id}` : "/api/admin/houses", {
      method: value.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить");
    router.replace("/admin/houses");
    router.refresh();
  }
  return <form className="panel form-stack" onSubmit={submit}>{message && <div className="notice error">{message}</div>}<div className="form-grid"><div className="field"><label htmlFor="name">Название</label><input id="name" name="name" defaultValue={value.name} required /></div><div className="field"><label htmlFor="slug">Slug</label><input id="slug" name="slug" defaultValue={value.slug} pattern="[a-z0-9-]+" required /></div></div><div className="field"><label htmlFor="badgeText">Бейдж карточки</label><input id="badgeText" name="badgeText" type="text" maxLength={80} placeholder="Например: Флагманский дом" defaultValue={value.badgeText ?? ""} /></div><div className="field"><label htmlFor="shortDescription">Краткое описание</label><textarea id="shortDescription" name="shortDescription" defaultValue={value.shortDescription} required /></div><div className="field"><label htmlFor="description">Полное описание</label><textarea id="description" name="description" defaultValue={value.description} required /></div><div className="form-grid"><div className="field"><label htmlFor="guests">Гостей</label><input id="guests" name="guests" type="number" min="1" defaultValue={value.guests ?? 2} required /></div><div className="field"><label htmlFor="rooms">Комнат</label><input id="rooms" name="rooms" type="number" min="1" defaultValue={value.rooms ?? 1} required /></div></div><div className="field"><label htmlFor="amenities">Удобства через запятую</label><input id="amenities" name="amenities" defaultValue={value.amenities?.join(", ")} required /></div><fieldset className="weekday-price-fieldset" aria-labelledby="weekday-prices-title"><div className="weekday-price-heading"><div><h2 id="weekday-prices-title">Цены по дням недели</h2><small>Стоимость одной ночи в BYN</small></div><button className="button button-ghost" type="button" onClick={copyMondayPrice} disabled={!weekdayPrices.monday}>Скопировать понедельник на все дни</button></div><div className="weekday-price-grid">{weekdays.map((weekday) => <div className="field" key={weekday}><label htmlFor={`price-${weekday}`}>{weekdayLabels[weekday]}</label><div className="price-input"><input id={`price-${weekday}`} type="number" min="0.01" step="0.01" value={weekdayPrices[weekday]} onChange={(event) => setWeekdayPrices((prices) => ({ ...prices, [weekday]: event.target.value }))} required /><span>BYN</span></div></div>)}</div></fieldset><div className="field"><label htmlFor="seoTitle">SEO title</label><input id="seoTitle" name="seoTitle" defaultValue={value.seoTitle} minLength={10} maxLength={70} required /></div><div className="field"><label htmlFor="seoDescription">SEO description</label><textarea id="seoDescription" name="seoDescription" defaultValue={value.seoDescription} minLength={30} maxLength={180} required /></div><label><input type="checkbox" name="isPublished" defaultChecked={value.isPublished} /> Опубликован</label><button className="button button-primary">Сохранить</button></form>;
}
