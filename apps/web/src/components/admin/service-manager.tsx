"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "@/lib/catalog";

type PriceUnit = "hour" | "day" | "booking" | "person" | "item";

interface ServiceRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  basePrice: string;
  priceUnit: PriceUnit;
  isActive: boolean;
  sortOrder: number;
}

interface OptionRow {
  id: string;
  serviceId: string;
  title: string;
  description: string | null;
  price: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

interface HouseRow {
  id: string;
  name: string;
}

const emptyService = {
  title: "",
  slug: "",
  description: "",
  imageUrl: "",
  basePrice: "0",
  priceUnit: "booking" as PriceUnit,
  isActive: true,
  sortOrder: 0,
  houseIds: [] as string[]
};

export function ServiceManager({ services, options, houses, serviceHouseIds }: { services: ServiceRow[]; options: OptionRow[]; houses: HouseRow[]; serviceHouseIds: Record<string, string[]> }) {
  const router = useRouter();
  const [editing, setEditing] = useState<(typeof emptyService & { id?: string })>(emptyService);
  const [optionDrafts, setOptionDrafts] = useState<Record<string, Partial<OptionRow>>>({});
  const [message, setMessage] = useState("");

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(editing.id ? `/api/admin/services/${editing.id}` : "/api/admin/services", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editing, basePrice: Number(editing.basePrice), imageUrl: editing.imageUrl || null })
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить услугу");
    setEditing(emptyService);
    router.refresh();
  }

  async function saveOption(serviceId: string, option?: OptionRow) {
    const draft = option ? optionDrafts[option.id] ?? option : optionDrafts[serviceId] ?? {};
    const payload = {
      title: draft.title ?? "",
      description: draft.description ?? "",
      price: Number(draft.price ?? 0),
      isDefault: Boolean(draft.isDefault),
      isActive: draft.isActive ?? true,
      sortOrder: Number(draft.sortOrder ?? 0)
    };
    const response = await fetch(option ? `/api/admin/service-options/${option.id}` : `/api/admin/services/${serviceId}/options`, {
      method: option ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить вариант");
    setOptionDrafts((value) => ({ ...value, [option?.id ?? serviceId]: {} }));
    router.refresh();
  }

  async function deleteOption(id: string) {
    await fetch(`/api/admin/service-options/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return <div className="form-stack">{message && <div className="notice error">{message}</div>}<section className="panel"><h2>{editing.id ? "Редактирование услуги" : "Новая услуга"}</h2><form className="form-stack" onSubmit={saveService}><div className="form-grid"><div className="field"><label>Название</label><input value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} required /></div><div className="field"><label>Slug</label><input value={editing.slug} onChange={(event) => setEditing({ ...editing, slug: event.target.value })} required /></div></div><div className="field"><label>Описание</label><textarea value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} required /></div><div className="form-grid"><div className="field"><label>Фото URL</label><input value={editing.imageUrl ?? ""} onChange={(event) => setEditing({ ...editing, imageUrl: event.target.value })} /></div><div className="field"><label>Базовая цена</label><input type="number" min="0" value={editing.basePrice} onChange={(event) => setEditing({ ...editing, basePrice: event.target.value })} /></div></div><div className="form-grid"><div className="field"><label>Единица</label><select value={editing.priceUnit} onChange={(event) => setEditing({ ...editing, priceUnit: event.target.value as PriceUnit })}><option value="hour">за час</option><option value="day">за день</option><option value="booking">за бронь</option><option value="person">за человека</option><option value="item">за штуку</option></select></div><div className="field"><label>Порядок</label><input type="number" min="0" value={editing.sortOrder} onChange={(event) => setEditing({ ...editing, sortOrder: Number(event.target.value) })} /></div></div><div className="field"><label>Домики</label><select multiple value={editing.houseIds} onChange={(event) => setEditing({ ...editing, houseIds: [...event.target.selectedOptions].map((item) => item.value) })}>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select><small>Если ничего не выбрано, услуга доступна для всех домиков.</small></div><label><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} /> Опубликована</label><div style={{ display: "flex", gap: 10 }}><button className="button button-primary">Сохранить</button><button className="button button-ghost" type="button" onClick={() => setEditing(emptyService)}>Очистить</button></div></form></section><section className="panel"><h2>Услуги</h2><table className="data-table"><thead><tr><th>Услуга</th><th>Цена</th><th>Публикация</th><th>Действие</th></tr></thead><tbody>{services.map((service) => <tr key={service.id}><td><strong>{service.title}</strong><br /><small>/{service.slug}</small></td><td>{formatCurrency(Number(service.basePrice))}</td><td><span className={`badge ${service.isActive ? "" : "badge-warn"}`}>{service.isActive ? "Активна" : "Скрыта"}</span></td><td><button className="button button-ghost" onClick={() => setEditing({ ...service, basePrice: String(service.basePrice), imageUrl: service.imageUrl ?? "", houseIds: serviceHouseIds[service.id] ?? [] })}>Редактировать</button></td></tr>)}</tbody></table>{!services.length && <p className="notice">Услуг пока нет.</p>}</section>{services.map((service) => <section className="panel" key={`options-${service.id}`}><h2>Варианты: {service.title}</h2><table className="data-table"><thead><tr><th>Название</th><th>Цена</th><th>Порядок</th><th>Статус</th><th /></tr></thead><tbody>{options.filter((option) => option.serviceId === service.id).map((option) => {
    const draft = optionDrafts[option.id] ?? option;
    return <tr key={option.id}><td><input value={draft.title ?? ""} onChange={(event) => setOptionDrafts((value) => ({ ...value, [option.id]: { ...draft, title: event.target.value } }))} /></td><td><input type="number" value={draft.price ?? "0"} onChange={(event) => setOptionDrafts((value) => ({ ...value, [option.id]: { ...draft, price: event.target.value } }))} /></td><td><input type="number" value={draft.sortOrder ?? 0} onChange={(event) => setOptionDrafts((value) => ({ ...value, [option.id]: { ...draft, sortOrder: Number(event.target.value) } }))} /></td><td><label><input type="checkbox" checked={draft.isActive ?? true} onChange={(event) => setOptionDrafts((value) => ({ ...value, [option.id]: { ...draft, isActive: event.target.checked } }))} /> активен</label><br /><label><input type="checkbox" checked={draft.isDefault ?? false} onChange={(event) => setOptionDrafts((value) => ({ ...value, [option.id]: { ...draft, isDefault: event.target.checked } }))} /> по умолчанию</label></td><td><button className="button button-ghost" onClick={() => saveOption(service.id, option)}>Сохранить</button> <button className="button button-ghost" onClick={() => deleteOption(option.id)}>Удалить</button></td></tr>;
  })}</tbody></table><div className="form-grid" style={{ marginTop: 18 }}><input placeholder="Название варианта" value={optionDrafts[service.id]?.title ?? ""} onChange={(event) => setOptionDrafts((value) => ({ ...value, [service.id]: { ...value[service.id], title: event.target.value } }))} /><input placeholder="Цена" type="number" value={optionDrafts[service.id]?.price ?? ""} onChange={(event) => setOptionDrafts((value) => ({ ...value, [service.id]: { ...value[service.id], price: event.target.value } }))} /><button className="button button-primary" onClick={() => saveOption(service.id)}>Добавить вариант</button></div></section>)}</div>;
}
