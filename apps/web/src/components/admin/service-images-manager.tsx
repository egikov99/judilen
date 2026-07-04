"use client";

import Image from "next/image";
import { useState } from "react";
import { createEntityImageUploadForm } from "@/lib/entity-image-upload";

export interface ServiceImageRow {
  id: string;
  serviceId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

type SelectedImage = { file: File; preview: string };
type Feedback = { kind: "success" | "error"; text: string };

function reportDevError(message: string, context: unknown) {
  if (process.env.NODE_ENV !== "production") console.error(message, context);
}

export function ServiceImagesManager({ serviceId, initialImages }: {
  serviceId: string;
  initialImages: ServiceImageRow[];
}) {
  const [images, setImages] = useState(initialImages);
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [alt, setAlt] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function selectFiles(files: FileList | File[]) {
    const next = await Promise.all(Array.from(files).map((file) => new Promise<SelectedImage>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ file, preview: String(reader.result ?? "") });
      reader.readAsDataURL(file);
    })));
    setSelected((current) => [...current, ...next]);
  }

  async function uploadSelected() {
    if (!selected.length) return;
    setBusy(true);
    setFeedback(null);
    try {
      const form = createEntityImageUploadForm(
        selected.map((image) => image.file),
        { key: "serviceId", id: serviceId },
        { alt }
      );
      const response = await fetch(`/api/admin/services/${serviceId}/images`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.title ?? `Не удалось загрузить фотографии (HTTP ${response.status})`);
      const created = Array.isArray(body.items) ? body.items as ServiceImageRow[] : [];
      setImages((rows) => [...rows, ...created]);
      setSelected([]);
      setAlt("");
      setFeedback({ kind: "success", text: `Фотографии загружены: ${created.length}` });
    } catch (error) {
      reportDevError("Service image upload failed", { serviceId, error });
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Не удалось загрузить фотографии" });
    } finally {
      setBusy(false);
    }
  }

  async function save(image: ServiceImageRow) {
    const nextAlt = edits[image.id] ?? image.alt;
    setBusy(true);
    setFeedback(null);
    const response = await fetch(`/api/admin/service-images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: nextAlt })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setFeedback({ kind: "error", text: body.title ?? "Не удалось сохранить фотографию" });
    setImages((rows) => rows.map((row) => row.id === image.id ? body.item : row));
    setFeedback({ kind: "success", text: "Данные фотографии сохранены" });
  }

  async function remove(image: ServiceImageRow) {
    setBusy(true);
    setFeedback(null);
    const response = await fetch(`/api/admin/service-images/${image.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setFeedback({ kind: "error", text: body.title ?? "Не удалось удалить фотографию" });
    setImages((rows) => rows.filter((row) => row.id !== image.id).map((row, index) => ({ ...row, sortOrder: index })));
    setFeedback({ kind: "success", text: "Фотография удалена" });
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setFeedback(null);
    const response = await fetch(`/api/admin/services/${serviceId}/images/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((image) => image.id) })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setFeedback({ kind: "error", text: body.title ?? "Не удалось изменить порядок фотографий" });
    setImages(next.map((image, nextIndex) => ({ ...image, sortOrder: nextIndex })));
    setFeedback({ kind: "success", text: "Порядок фотографий сохранён" });
  }

  return <section className="service-images-section">
    <div className="section-heading compact-heading"><div><span className="eyebrow">Медиа</span><h3>Фотографии услуги</h3></div></div>
    <p className="admin-section-description">Можно загрузить любое разумное количество файлов. Первое фото используется в карточке услуги.</p>
    {feedback && <div className={`notice${feedback.kind === "error" ? " error" : ""}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.text}</div>}
    <div className="photo-upload-form">
      <label className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
        event.preventDefault();
        if (!busy) void selectFiles(event.dataTransfer.files);
      }}>
        <input className="visually-hidden" type="file" multiple disabled={busy} accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => event.target.files && void selectFiles(event.target.files)} />
        <span>Перетащите фотографии сюда или выберите файлы</span>
      </label>
      <div className="form-stack">
        <div className="field"><label>Alt-текст (необязательно)</label><input value={alt} onChange={(event) => setAlt(event.target.value)} /></div>
        <small>Если поле пустое, alt-текст будет создан из имени файла.</small>
        {busy && <progress aria-label="Загрузка фотографий" />}
        <button className="button button-primary" type="button" disabled={busy || !selected.length} onClick={() => void uploadSelected()}>
          {busy ? `Загрузка (${selected.length})…` : `Загрузить${selected.length ? ` (${selected.length})` : ""}`}
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
        <Image src={image.url} alt={image.alt} width={360} height={240} unoptimized={image.url.startsWith("/uploads/")} onError={() => reportDevError("Service image preview failed to load", { imageId: image.id, src: image.url })} />
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
