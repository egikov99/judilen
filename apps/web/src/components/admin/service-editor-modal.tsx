"use client";

import { useState, type FormEvent } from "react";
import { AdminModal } from "@/components/admin/admin-modal";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { formatCurrency } from "@/components/currency";

export type PriceUnit = "hour" | "day" | "booking" | "person" | "item";
export interface ServiceRow {
  id: string; title: string; slug: string; description: string; imageUrl: string | null;
  basePrice: string; priceUnit: PriceUnit; isActive: boolean; sortOrder: number;
}
export interface OptionRow {
  id: string; serviceId: string; title: string; description: string | null; price: string;
  isDefault: boolean; isActive: boolean; sortOrder: number;
}
export interface HouseRow { id: string; name: string; }

const emptyService = {
  title: "", slug: "", description: "", imageUrl: "", basePrice: "0",
  priceUnit: "booking" as PriceUnit, isActive: true, sortOrder: 0, houseIds: [] as string[]
};
const emptyOption = {
  title: "", description: "", price: "0", isDefault: false, isActive: true, sortOrder: 0
};

export function ServiceEditorModal({ service, initialOptions, houses, houseIds, onClose, onChanged, optionPermissions }: {
  service: ServiceRow | null;
  initialOptions: OptionRow[];
  houses: HouseRow[];
  houseIds: string[];
  onClose: () => void;
  onChanged: (message: string) => void;
  optionPermissions: { create: boolean; update: boolean; delete: boolean };
}) {
  const [draft, setDraft] = useState({ ...(service ?? emptyService), imageUrl: service?.imageUrl ?? "", houseIds });
  const [serviceId, setServiceId] = useState(service?.id ?? "");
  const [optionRows, setOptionRows] = useState(initialOptions);
  const [optionDraft, setOptionDraft] = useState<(typeof emptyOption & { id?: string }) | null>(null);
  const [saving, setSaving] = useState<"service" | "option" | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("service"); setError(""); setSuccess("");
    const response = await fetch(serviceId ? `/api/admin/services/${serviceId}` : "/api/admin/services", {
      method: serviceId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, basePrice: Number(draft.basePrice), imageUrl: draft.imageUrl || null })
    });
    const body = await response.json().catch(() => ({}));
    setSaving("");
    if (!response.ok) return setError(body.title ?? "Не удалось сохранить услугу");
    setServiceId(body.item.id);
    setSuccess("Услуга сохранена");
    onChanged("Услуга сохранена");
  }

  async function saveOption(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceId || !optionDraft) return;
    setSaving("option"); setError(""); setSuccess("");
    const payload = {
      title: optionDraft.title,
      description: optionDraft.description || null,
      price: Number(optionDraft.price),
      isDefault: optionDraft.isDefault,
      isActive: optionDraft.isActive,
      sortOrder: Number(optionDraft.sortOrder)
    };
    const response = await fetch(optionDraft.id ? `/api/admin/service-options/${optionDraft.id}` : `/api/admin/services/${serviceId}/options`, {
      method: optionDraft.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    setSaving("");
    if (!response.ok) return setError(body.title ?? "Не удалось сохранить вариант");
    setOptionRows((rows) => {
      const normalized = optionDraft.isDefault ? rows.map((row) => ({ ...row, isDefault: false })) : rows;
      return optionDraft.id
        ? normalized.map((row) => row.id === optionDraft.id ? { ...row, ...body.item, price: String(body.item.price) } : row)
        : [...normalized, { ...body.item, price: String(body.item.price) }];
    });
    setOptionDraft(null);
    setSuccess("Вариант сохранён");
    onChanged("Вариант сохранён");
  }

  async function deleteOption(id: string) {
    if (!confirm("Удалить вариант услуги?")) return;
    setSaving("option"); setError("");
    const response = await fetch(`/api/admin/service-options/${id}`, { method: "DELETE" });
    setSaving("");
    if (!response.ok) return setError("Не удалось удалить вариант");
    setOptionRows((rows) => rows.filter((row) => row.id !== id));
    setOptionDraft(null);
    setSuccess("Вариант удалён");
    onChanged("Вариант удалён");
  }

  return <AdminModal title={serviceId ? "Редактирование услуги" : "Новая услуга"} onClose={onClose} busy={!!saving}>
    {error && <div className="notice error" role="alert">{error}</div>}
    {success && <div className="notice" role="status">{success}</div>}
    <form className="form-stack" onSubmit={saveService}>
      <div className="form-grid"><div className="field"><label>Название</label><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} minLength={2} maxLength={140} required /></div><div className="field"><label>Slug</label><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div></div>
      <div className="field"><label>Описание</label><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} minLength={5} required /></div>
      <div className="form-grid"><ImageUploadField value={draft.imageUrl} onChange={(imageUrl) => setDraft({ ...draft, imageUrl })} label="Фото услуги" /><div className="form-stack"><div className="field"><label>Базовая цена</label><input type="number" min="0" step="0.01" value={draft.basePrice} onChange={(event) => setDraft({ ...draft, basePrice: event.target.value })} required /></div><div className="field"><label>Единица</label><select value={draft.priceUnit} onChange={(event) => setDraft({ ...draft, priceUnit: event.target.value as PriceUnit })}><option value="hour">за час</option><option value="day">за день</option><option value="booking">за бронь</option><option value="person">за человека</option><option value="item">за штуку</option></select></div><div className="field"><label>Порядок</label><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></div></div></div>
      <div className="field"><label>Домики</label><select multiple value={draft.houseIds} onChange={(event) => setDraft({ ...draft, houseIds: [...event.target.selectedOptions].map((item) => item.value) })}>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select><small>Если ничего не выбрано, услуга доступна для всех домиков.</small></div>
      <label><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Опубликована</label>
      <div className="modal-actions"><button className="button button-primary" disabled={!!saving}>{saving === "service" ? "Сохранение…" : "Сохранить услугу"}</button><button className="button button-ghost" type="button" disabled={!!saving} onClick={onClose}>Закрыть</button></div>
    </form>

    <section className="service-options-section">
      <div className="section-heading compact-heading"><div><span className="eyebrow">Настройки</span><h3>Варианты услуги</h3></div>{serviceId && optionPermissions.create && <button className="button button-ghost" type="button" onClick={() => setOptionDraft({ ...emptyOption, sortOrder: optionRows.length })}>Добавить вариант</button>}</div>
      {!serviceId && <p className="notice">Сначала сохраните услугу, после этого можно добавить варианты.</p>}
      {serviceId && !optionRows.length && !optionDraft && <p className="notice">Вариантов пока нет.</p>}
      <div className="service-option-list">{[...optionRows].sort((a, b) => a.sortOrder - b.sortOrder).map((option) => <article className="service-option-card" key={option.id}><div><strong>{option.title}</strong><p>{option.description || "Без описания"}</p></div><div className="service-option-meta"><strong>{formatCurrency(Number(option.price))}</strong><span className="badge">Порядок: {option.sortOrder}</span>{option.isDefault && <span className="badge">По умолчанию</span>}{!option.isActive && <span className="badge badge-warn">Скрыт</span>}</div><div className="action-row">{optionPermissions.update && <button className="button button-ghost" type="button" onClick={() => setOptionDraft({ ...option, description: option.description ?? "", price: String(option.price) })}>Редактировать</button>}{optionPermissions.delete && <button className="button button-ghost" type="button" disabled={saving === "option"} onClick={() => deleteOption(option.id)}>Удалить</button>}</div></article>)}</div>
      {optionDraft && <form className="option-editor" onSubmit={saveOption}><h4>{optionDraft.id ? "Редактирование варианта" : "Новый вариант"}</h4><div className="form-grid"><div className="field"><label>Название</label><input value={optionDraft.title} onChange={(event) => setOptionDraft({ ...optionDraft, title: event.target.value })} required /></div><div className="field"><label>Цена</label><input type="number" min="0" step="0.01" value={optionDraft.price} onChange={(event) => setOptionDraft({ ...optionDraft, price: event.target.value })} required /></div></div><div className="field"><label>Описание</label><textarea value={optionDraft.description} onChange={(event) => setOptionDraft({ ...optionDraft, description: event.target.value })} /></div><div className="form-grid"><div className="field"><label>Порядок</label><input type="number" min="0" value={optionDraft.sortOrder} onChange={(event) => setOptionDraft({ ...optionDraft, sortOrder: Number(event.target.value) })} /></div><div className="form-stack compact-checks"><label><input type="checkbox" checked={optionDraft.isActive} onChange={(event) => setOptionDraft({ ...optionDraft, isActive: event.target.checked })} /> Активен</label><label><input type="checkbox" checked={optionDraft.isDefault} onChange={(event) => setOptionDraft({ ...optionDraft, isDefault: event.target.checked })} /> По умолчанию</label></div></div><div className="action-row"><button className="button button-primary" disabled={!!saving}>{saving === "option" ? "Сохранение…" : "Сохранить вариант"}</button><button className="button button-ghost" type="button" disabled={!!saving} onClick={() => setOptionDraft(null)}>Отмена</button></div></form>}
    </section>
  </AdminModal>;
}
