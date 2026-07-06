"use client";

import { useState, type FormEvent } from "react";

type Row = {
  id: string;
  name: string;
  slug?: string;
  color: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
};

const icons = ["circle", "globe", "phone", "instagram", "message-circle", "building", "home", "hotel", "map", "users", "heart", "receipt", "zap", "wrench", "shopping-cart", "megaphone"];

export function ReferenceDataManager({ initialRows, endpoint, includeSlug, noun }: {
  initialRows: Row[];
  endpoint: string;
  includeSlug?: boolean;
  noun: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        ...(includeSlug ? { slug: String(form.get("slug") ?? "").trim() } : {}),
        color: form.get("color"),
        icon: form.get("icon"),
        sortOrder: Number(form.get("sortOrder")),
        isActive: true
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? `Не удалось создать ${noun}`);
    setRows((current) => [...current, body.item].sort((a, b) => a.sortOrder - b.sortOrder));
    event.currentTarget.reset();
    setMessage("Сохранено");
  }

  async function update(row: Row, values: Partial<Row>) {
    const response = await fetch(`${endpoint}/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить");
    setRows((current) => current.map((item) => item.id === row.id ? body.item : item).sort((a, b) => a.sortOrder - b.sortOrder));
    setMessage("Сохранено");
  }

  async function remove(row: Row) {
    const response = await fetch(`${endpoint}/${row.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.detail ?? body.title ?? "Нельзя удалить");
    setRows((current) => current.filter((item) => item.id !== row.id));
  }

  return <div className="form-stack">
    {message && <p className="notice" role="status">{message}</p>}
    <form className="panel form-stack" onSubmit={create}>
      <h2>Добавить {noun}</h2>
      <div className="form-grid">
        <div className="field"><label>Название</label><input name="name" required maxLength={100} /></div>
        {includeSlug && <div className="field"><label>Slug</label><input name="slug" pattern="[a-z0-9-]+" required /></div>}
      </div>
      <div className="form-grid">
        <div className="field"><label>Цвет</label><input name="color" type="color" defaultValue="#2d5a27" /></div>
        <div className="field"><label>Иконка</label><select name="icon" defaultValue="circle">{icons.map((icon) => <option key={icon}>{icon}</option>)}</select></div>
        <div className="field"><label>Порядок</label><input name="sortOrder" type="number" min="0" defaultValue={rows.length * 10 + 10} /></div>
      </div>
      <button className="button button-primary">Добавить</button>
    </form>
    <section className="panel">
      <div className="reference-list">{rows.map((row) => <ReferenceRow key={row.id} row={row} includeSlug={includeSlug} onUpdate={update} onDelete={remove} />)}</div>
      {!rows.length && <p className="notice">Записей пока нет.</p>}
    </section>
  </div>;
}

function ReferenceRow({ row, includeSlug, onUpdate, onDelete }: {
  row: Row;
  includeSlug?: boolean;
  onUpdate: (row: Row, values: Partial<Row>) => Promise<void>;
  onDelete: (row: Row) => Promise<void>;
}) {
  const [draft, setDraft] = useState(row);
  return <div className="reference-row">
    <input aria-label="Название" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
    {includeSlug && <input aria-label="Slug" value={draft.slug ?? ""} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />}
    <input aria-label="Цвет" type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
    <select aria-label="Иконка" value={draft.icon} onChange={(event) => setDraft({ ...draft, icon: event.target.value })}>{icons.map((icon) => <option key={icon}>{icon}</option>)}</select>
    <input aria-label="Порядок" type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} />
    <label className="reference-active"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Активен</label>
    <div className="reference-actions"><button className="button button-primary" type="button" onClick={() => onUpdate(row, draft)}>Сохранить</button><button className="button button-ghost" type="button" onClick={() => onDelete(row)}>Удалить</button></div>
  </div>;
}
