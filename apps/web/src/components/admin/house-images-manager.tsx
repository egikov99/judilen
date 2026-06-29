"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImageRow {
  id: string;
  houseId: string;
  url: string;
  alt: string;
  caption: string | null;
  position: number;
  isMain: boolean;
  isActive: boolean;
}

const emptyImage = { url: "", alt: "", caption: "", position: 0, isMain: false, isActive: true };

export function HouseImagesManager({ houseId, images }: { houseId: string; images: ImageRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState(emptyImage);
  const [edits, setEdits] = useState<Record<string, Partial<ImageRow>>>({});
  const [message, setMessage] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(`/api/admin/houses/${houseId}/images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, caption: draft.caption || null })
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось добавить фото");
    setDraft(emptyImage);
    router.refresh();
  }

  async function save(image: ImageRow) {
    const payload = edits[image.id] ?? image;
    const response = await fetch(`/api/admin/house-images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить фото");
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/house-images/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return <section className="panel"><h2>Фотографии</h2>{message && <div className="notice error">{message}</div>}<form className="form-stack" onSubmit={create}><div className="form-grid"><div className="field"><label>URL фото</label><input value={draft.url} onChange={(event) => setDraft({ ...draft, url: event.target.value })} required /></div><div className="field"><label>Alt-текст</label><input value={draft.alt} onChange={(event) => setDraft({ ...draft, alt: event.target.value })} required /></div></div><div className="form-grid"><div className="field"><label>Подпись</label><input value={draft.caption} onChange={(event) => setDraft({ ...draft, caption: event.target.value })} /></div><div className="field"><label>Порядок</label><input type="number" value={draft.position} onChange={(event) => setDraft({ ...draft, position: Number(event.target.value) })} /></div></div><label><input type="checkbox" checked={draft.isMain} onChange={(event) => setDraft({ ...draft, isMain: event.target.checked })} /> Главное фото</label><button className="button button-primary">Добавить фото</button></form><table className="data-table" style={{ marginTop: 20 }}><thead><tr><th>Фото</th><th>Alt / подпись</th><th>Порядок</th><th>Статус</th><th /></tr></thead><tbody>{images.map((image) => {
    const edit = edits[image.id] ?? image;
    return <tr key={image.id}><td><input value={edit.url ?? ""} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, url: event.target.value } }))} /></td><td><input value={edit.alt ?? ""} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, alt: event.target.value } }))} /><input value={edit.caption ?? ""} placeholder="Подпись" onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, caption: event.target.value } }))} /></td><td><input type="number" value={edit.position ?? 0} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, position: Number(event.target.value) } }))} /></td><td><label><input type="checkbox" checked={edit.isMain ?? false} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, isMain: event.target.checked } }))} /> главное</label><br /><label><input type="checkbox" checked={edit.isActive ?? true} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, isActive: event.target.checked } }))} /> активно</label></td><td><button className="button button-ghost" onClick={() => save(image)}>Сохранить</button> <button className="button button-ghost" onClick={() => remove(image.id)}>Удалить</button></td></tr>;
  })}</tbody></table>{!images.length && <p className="notice">Фотографии пока не загружены. На публичном сайте будет показан placeholder.</p>}</section>;
}
