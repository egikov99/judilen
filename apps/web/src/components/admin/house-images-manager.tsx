"use client";

import Image from "next/image";
import { useState } from "react";
import { createEntityImageUploadForm } from "@/lib/entity-image-upload";

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

type SelectedImage = { file: File; preview: string };
type Feedback = { kind: "success" | "error"; text: string };

function reportDevError(message: string, context: unknown) {
  if (process.env.NODE_ENV !== "production") console.error(message, context);
}

export function HouseImagesManager({ houseId, images: initialImages }: { houseId: string; images: ImageRow[] }) {
  const [images, setImages] = useState(initialImages);
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<ImageRow>>>({});
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
        { key: "houseId", id: houseId },
        { alt, caption }
      );
      const response = await fetch(`/api/admin/houses/${houseId}/images/upload`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.title ?? `Не удалось загрузить фотографии (HTTP ${response.status})`);
      const created = Array.isArray(body.items) ? body.items as ImageRow[] : [];
      setImages((rows) => [...rows, ...created]);
      setSelected([]);
      setAlt("");
      setCaption("");
      setFeedback({ kind: "success", text: `Фотографии загружены: ${created.length}` });
    } catch (error) {
      reportDevError("House image upload failed", { houseId, error });
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Не удалось загрузить фотографии" });
    } finally {
      setBusy(false);
    }
  }

  async function replace(image: ImageRow, file: File) {
    const current = { ...image, ...edits[image.id] };
    setBusy(true);
    setFeedback(null);
    const form = new FormData();
    form.set("file", file);
    form.set("scope", "houses");
    form.set("houseId", houseId);
    form.set("imageId", image.id);
    form.set("alt", current.alt);
    form.set("caption", current.caption ?? "");
    form.set("position", String(current.position));
    form.set("isMain", String(current.isMain));
    form.set("isActive", String(current.isActive));
    try {
      const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.title ?? "Не удалось заменить фотографию");
      setImages((rows) => rows.map((row) => row.id === image.id ? body.item : row));
      setFeedback({ kind: "success", text: "Фотография заменена" });
    } catch (error) {
      reportDevError("House image replacement failed", { houseId, imageId: image.id, error });
      setFeedback({ kind: "error", text: error instanceof Error ? error.message : "Не удалось заменить фотографию" });
    } finally {
      setBusy(false);
    }
  }

  async function save(image: ImageRow) {
    setBusy(true);
    setFeedback(null);
    const response = await fetch(`/api/admin/house-images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits[image.id] ?? image)
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setFeedback({ kind: "error", text: body.title ?? "Не удалось сохранить фото" });
    setImages((rows) => rows.map((row) => row.id === image.id ? body.item : row));
    setFeedback({ kind: "success", text: "Данные фотографии сохранены" });
  }

  async function remove(id: string) {
    setBusy(true);
    setFeedback(null);
    const response = await fetch(`/api/admin/house-images/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setFeedback({ kind: "error", text: body.title ?? "Не удалось удалить фото" });
    setImages((rows) => rows.filter((row) => row.id !== id).map((row, index) => ({ ...row, position: index, isMain: index === 0 })));
    setFeedback({ kind: "success", text: "Фотография удалена" });
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true);
    setFeedback(null);
    const response = await fetch(`/api/admin/houses/${houseId}/images/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((image) => image.id) })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setFeedback({ kind: "error", text: body.title ?? "Не удалось изменить порядок фотографий" });
    setImages(next.map((image, nextIndex) => ({ ...image, position: nextIndex, isMain: nextIndex === 0 })));
    setFeedback({ kind: "success", text: "Порядок фотографий сохранён" });
  }

  return <section className="panel house-photo-panel">
    <h2>Фотографии</h2>
    <p className="admin-section-description">Можно выбрать сразу несколько файлов. Все фотографии сохраняются; первая в списке используется в карточке домика.</p>
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
        <div className="field"><label>Подпись</label><input value={caption} onChange={(event) => setCaption(event.target.value)} /></div>
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
    {images.length ? <div className="photo-admin-grid">{images.map((image, index) => {
      const edit = { ...image, ...edits[image.id] };
      return <article className="photo-admin-card" key={image.id}>
        <div className="photo-admin-preview"><Image src={image.url} alt={image.alt} width={360} height={240} unoptimized={image.url.startsWith("/uploads/")} onError={() => reportDevError("House image preview failed to load", { imageId: image.id, src: image.url })} />{index === 0 && <span className="badge">Главное фото</span>}</div>
        <div className="form-stack">
          <div className="field"><label>Alt-текст</label><input value={edit.alt} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, alt: event.target.value } }))} /></div>
          <div className="field"><label>Подпись</label><input value={edit.caption ?? ""} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, caption: event.target.value } }))} /></div>
          <label><input type="checkbox" checked={edit.isActive} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, isActive: event.target.checked } }))} /> Активно</label>
          <div className="action-row"><button className="icon-button" type="button" title="Переместить назад" disabled={busy || index === 0} onClick={() => void move(index, -1)}>↑</button><button className="icon-button" type="button" title="Переместить вперёд" disabled={busy || index === images.length - 1} onClick={() => void move(index, 1)}>↓</button><label className="button button-ghost">Заменить<input className="visually-hidden" type="file" disabled={busy} accept=".jpg,.jpeg,.png,.webp" onChange={(event) => event.target.files?.[0] && void replace(image, event.target.files[0])} /></label></div>
          <div className="action-row"><button className="button button-primary" type="button" disabled={busy} onClick={() => void save(image)}>Сохранить</button><button className="button button-ghost" type="button" disabled={busy} onClick={() => void remove(image.id)}>Удалить</button></div>
        </div>
      </article>;
    })}</div> : <p className="notice">Фотографии пока не загружены. На публичном сайте будет показан placeholder.</p>}
  </section>;
}
