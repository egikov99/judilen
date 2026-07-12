"use client";

import { useState, type FormEvent } from "react";
import { AdminModal } from "@/components/admin/admin-modal";
import { GazeboImagesManager, type GazeboImageRow } from "@/components/admin/gazebo-images-manager";
import type { Permission } from "@judilen/auth";

export interface GazeboRow {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  amenities: string[];
  images: GazeboImageRow[];
  isPublished: boolean;
  sortOrder: number;
}

const emptyGazebo = {
  title: "",
  slug: "",
  shortDescription: "",
  description: "",
  amenities: [] as string[],
  images: [] as GazeboImageRow[],
  isPublished: true,
  sortOrder: 0
};

export function GazeboManager({ gazebos, permissions }: {
  gazebos: GazeboRow[];
  permissions: Permission[];
}) {
  const [items, setItems] = useState(gazebos);
  const [selected, setSelected] = useState<GazeboRow | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState("");
  const [notice, setNotice] = useState("");
  const canCreate = permissions.includes("gazebos.create");
  const canUpdate = permissions.includes("gazebos.update");
  const canDelete = permissions.includes("gazebos.delete");

  async function reload(message: string) {
    const response = await fetch("/api/admin/gazebos");
    const body = await response.json().catch(() => ({}));
    if (response.ok && Array.isArray(body.items)) setItems(body.items);
    setNotice(message);
  }

  async function remove(gazebo: GazeboRow) {
    if (!confirm(`Удалить беседку «${gazebo.title}»?`)) return;
    setDeletingId(gazebo.id);
    const response = await fetch(`/api/admin/gazebos/${gazebo.id}`, { method: "DELETE" });
    setDeletingId("");
    if (!response.ok) return setNotice("Не удалось удалить беседку");
    setItems((rows) => rows.filter((row) => row.id !== gazebo.id));
    setNotice("Беседка удалена");
  }

  return <>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="admin-list-toolbar"><div><strong>{items.length}</strong> беседок</div>{canCreate && <button className="button button-primary" onClick={() => setSelected(null)}>Добавить беседку</button>}</div>
    {items.length ? <table className="data-table"><thead><tr><th>Беседка</th><th>Порядок</th><th>Фото</th><th>Публикация</th>{(canUpdate || canDelete) && <th>Действия</th>}</tr></thead><tbody>{items.map((gazebo) => <tr key={gazebo.id}><td data-label="Беседка"><strong>{gazebo.title}</strong><br /><small>/{gazebo.slug}</small></td><td data-label="Порядок">{gazebo.sortOrder}</td><td data-label="Фото">{gazebo.images.length}</td><td data-label="Публикация"><span className={`badge ${gazebo.isPublished ? "" : "badge-warn"}`}>{gazebo.isPublished ? "Опубликована" : "Скрыта"}</span></td>{(canUpdate || canDelete) && <td data-label=""><div className="action-row">{canUpdate && <button className="button button-ghost" onClick={() => setSelected(gazebo)}>Редактировать</button>}{canDelete && <button className="button button-ghost" disabled={deletingId === gazebo.id} onClick={() => remove(gazebo)}>{deletingId === gazebo.id ? "Удаление..." : "Удалить"}</button>}</div></td>}</tr>)}</tbody></table> : <p className="notice">Беседок пока нет.</p>}
    {selected !== undefined && <GazeboEditorModal gazebo={selected} onClose={() => setSelected(undefined)} onChanged={reload} />}
  </>;
}

function GazeboEditorModal({ gazebo, onClose, onChanged }: {
  gazebo: GazeboRow | null;
  onClose: () => void;
  onChanged: (message: string) => void;
}) {
  const [draft, setDraft] = useState(gazebo ?? emptyGazebo);
  const [gazeboId, setGazeboId] = useState(gazebo?.id ?? "");
  const [amenitiesText, setAmenitiesText] = useState((gazebo?.amenities ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    const response = await fetch(gazeboId ? `/api/admin/gazebos/${gazeboId}` : "/api/admin/gazebos", {
      method: gazeboId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        images: undefined,
        amenities: amenitiesText.split(",").map((item) => item.trim()).filter(Boolean),
        sortOrder: Number(draft.sortOrder)
      })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setError(body.title ?? "Не удалось сохранить беседку");
    setGazeboId(body.item.id);
    setSuccess("Беседка сохранена");
    onChanged("Беседка сохранена");
  }

  return <AdminModal title={gazeboId ? "Редактирование беседки" : "Новая беседка"} onClose={onClose} busy={saving}>
    {error && <div className="notice error" role="alert">{error}</div>}
    {success && <div className="notice" role="status">{success}</div>}
    <form className="form-stack" onSubmit={save}>
      <div className="form-grid"><div className="field"><label>Название</label><input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} minLength={2} maxLength={140} required /></div><div className="field"><label>Slug</label><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></div></div>
      <div className="field"><label>Краткое описание</label><textarea value={draft.shortDescription} onChange={(event) => setDraft({ ...draft, shortDescription: event.target.value })} minLength={10} required /></div>
      <div className="field"><label>Полное описание</label><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} minLength={20} required /></div>
      <div className="field"><label>Характеристики и удобства через запятую</label><input value={amenitiesText} onChange={(event) => setAmenitiesText(event.target.value)} /></div>
      <div className="field"><label>Порядок</label><input type="number" min="0" value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} /></div>
      <label><input type="checkbox" checked={draft.isPublished} onChange={(event) => setDraft({ ...draft, isPublished: event.target.checked })} /> Опубликована</label>
      <div className="modal-actions"><button className="button button-primary" disabled={saving}>{saving ? "Сохранение..." : "Сохранить беседку"}</button><button className="button button-ghost" type="button" disabled={saving} onClick={onClose}>Закрыть</button></div>
    </form>
    {gazeboId ? <GazeboImagesManager gazeboId={gazeboId} initialImages={gazebo?.images ?? []} /> : <p className="notice">Сначала сохраните беседку, после этого можно загрузить фотографии.</p>}
  </AdminModal>;
}
