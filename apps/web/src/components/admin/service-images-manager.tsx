"use client";

import Image from "next/image";
import { useState } from "react";

export interface ServiceImageRow {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

type SelectedImage = { file: File; preview: string };

export function ServiceImagesManager({ serviceId, initialImages }: {
  serviceId: string;
  initialImages: ServiceImageRow[];
}) {
  const [images, setImages] = useState(initialImages);
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [alt, setAlt] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [uploaded, setUploaded] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function selectFiles(files: FileList | File[]) {
    const next = await Promise.all(Array.from(files).map((file) => new Promise<SelectedImage>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ file, preview: String(reader.result ?? "") });
      reader.readAsDataURL(file);
    })));
    setSelected((current) => [...current, ...next]);
  }

  async function uploadSelected() {
    if (!selected.length || alt.trim().length < 2) return;
    setBusy(true);
    setMessage("");
    setUploaded(0);
    let completed = 0;
    const created: ServiceImageRow[] = [];
    try {
      for (const [index, image] of selected.entries()) {
        const form = new FormData();
        form.set("file", image.file);
        form.set("alt", selected.length > 1 ? `${alt.trim()}, фото ${index + 1}` : alt.trim());
        const response = await fetch(`/api/admin/services/${serviceId}/images`, { method: "POST", body: form });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.title ?? `Не удалось загрузить ${image.file.name}`);
        created.push(body.item);
        completed = index + 1;
        setUploaded(completed);
      }
      setImages((rows) => [...rows, ...created]);
      setSelected([]);
      setAlt("");
    } catch (error) {
      console.error("Service image upload failed", { serviceId, error });
      if (created.length) setImages((rows) => [...rows, ...created]);
      setSelected((items) => items.slice(completed));
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить фотографии");
    } finally {
      setBusy(false);
    }
  }

  async function save(image: ServiceImageRow) {
    const nextAlt = edits[image.id] ?? image.alt;
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/service-images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: nextAlt })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить фотографию");
    setImages((rows) => rows.map((row) => row.id === image.id ? body.item : row));
  }

  async function remove(image: ServiceImageRow) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/service-images/${image.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.title ?? "Не удалось удалить фотографию");
    setImages((rows) => rows.filter((row) => row.id !== image.id).map((row, index) => ({ ...row, sortOrder: index })));
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/services/${serviceId}/images/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((image) => image.id) })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(body.title ?? "Не удалось изменить порядок фотографий");
    setImages(next.map((image, nextIndex) => ({ ...image, sortOrder: nextIndex })));
  }

  return <section className="service-images-section">
    <div className="section-heading compact-heading"><div><span className="eyebrow">Медиа</span><h3>Фотографии услуги</h3></div></div>
    <p className="admin-section-description">Можно загрузить любое разумное количество файлов. Первое фото используется в карточке услуги.</p>
    {message && <div className="notice error">{message}</div>}
    <div className="photo-upload-form">
      <label className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        if (!busy) void selectFiles(event.dataTransfer.files);
      }}>
        <input className="visually-hidden" type="file" multiple disabled={busy} accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => event.target.files && void selectFiles(event.target.files)} />
        <span>Перетащите фотографии сюда или выберите файлы</span>
      </label>
      <div className="form-stack">
        <div className="field"><label>Alt-текст</label><input value={alt} onChange={(event) => setAlt(event.target.value)} required /></div>
        <small>Для нескольких файлов номер добавится автоматически.</small>
        {busy && <progress value={uploaded} max={selected.length}>{uploaded} из {selected.length}</progress>}
        <button className="button button-primary" type="button" disabled={busy || !selected.length || alt.trim().length < 2} onClick={() => void uploadSelected()}>
          {busy ? `Загружено ${uploaded} из ${selected.length}` : `Загрузить${selected.length ? ` (${selected.length})` : ""}`}
        </button>
      </div>
    </div>
    {!!selected.length && <div className="homepage-gallery-selection" aria-label="Предпросмотр выбранных фотографий">
      {selected.map((image, index) => <div className="homepage-gallery-selection-item" key={`${image.file.name}-${image.file.lastModified}-${index}`}>
        <Image src={image.preview} alt={`Предпросмотр ${image.file.name}`} width={180} height={120} unoptimized />
        <button type="button" aria-label={`Убрать ${image.file.name}`} disabled={busy} onClick={() => setSelected((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
      </div>)}
    </div>}
    {images.length ? <div className="photo-admin-grid">{images.map((image, index) => <article className="photo-admin-card" key={image.id}>
      <div className="photo-admin-preview">
        <Image src={image.url} alt={image.alt} width={360} height={240} unoptimized={image.url.startsWith("/uploads/")} onError={() => console.error("Service image preview failed to load", { imageId: image.id, src: image.url })} />
        {index === 0 && <span className="badge">Фото карточки</span>}
      </div>
      <div className="form-stack">
        <div className="field"><label>Alt-текст</label><input value={edits[image.id] ?? image.alt} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: event.target.value }))} /></div>
        <div className="action-row">
          <button className="icon-button" type="button" title="Переместить назад" disabled={busy || index === 0} onClick={() => void move(index, -1)}>↑</button>
          <button className="icon-button" type="button" title="Переместить вперёд" disabled={busy || index === images.length - 1} onClick={() => void move(index, 1)}>↓</button>
          <button className="button button-primary" type="button" disabled={busy} onClick={() => void save(image)}>Сохранить</button>
          <button className="button button-ghost" type="button" disabled={busy} onClick={() => void remove(image)}>Удалить</button>
        </div>
      </div>
    </article>)}</div> : <p className="notice">Фотографии услуги пока не загружены.</p>}
  </section>;
}
