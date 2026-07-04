"use client";

import Image from "next/image";
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

type SelectedImage = { file: File; preview: string };

export function HouseImagesManager({ houseId, images }: { houseId: string; images: ImageRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<ImageRow>>>({});
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
    if (!selected.length || alt.trim().length < 3) return;
    setBusy(true);
    setMessage("");
    setUploaded(0);
    let completed = 0;
    try {
      for (const [index, image] of selected.entries()) {
        const form = new FormData();
        form.set("file", image.file);
        form.set("scope", "houses");
        form.set("houseId", houseId);
        form.set("alt", selected.length > 1 ? `${alt.trim()}, фото ${index + 1}` : alt.trim());
        form.set("caption", caption.trim());
        form.set("position", String(images.length + index));
        form.set("isMain", String(!images.length && index === 0));
        form.set("isActive", "true");
        const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.title ?? `Не удалось загрузить ${image.file.name}`);
        completed = index + 1;
        setUploaded(completed);
      }
      setSelected([]);
      setAlt("");
      setCaption("");
      router.refresh();
    } catch (error) {
      console.error("House image upload failed", { houseId, error });
      setSelected((items) => items.slice(completed));
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить фотографии");
      if (completed > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function replace(image: ImageRow, file: File) {
    const current = { ...image, ...edits[image.id] };
    setBusy(true);
    setMessage("");
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
    const response = await fetch("/api/admin/uploads", { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      console.error("House image replacement failed", { houseId, imageId: image.id, status: response.status, response: body });
      return setMessage(body.title ?? "Не удалось заменить фотографию");
    }
    router.refresh();
  }

  async function save(image: ImageRow) {
    const response = await fetch(`/api/admin/house-images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits[image.id] ?? image)
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить фото");
    router.refresh();
  }

  async function remove(id: string) {
    setMessage("");
    const response = await fetch(`/api/admin/house-images/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось удалить фото");
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setMessage("");
    const response = await fetch(`/api/admin/houses/${houseId}/images/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((image) => image.id) })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось изменить порядок фотографий");
    router.refresh();
  }

  return <section className="panel house-photo-panel">
    <h2>Фотографии</h2>
    <p className="admin-section-description">Можно выбрать сразу несколько файлов. Все фотографии сохраняются; первая в списке используется в карточке домика.</p>
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
        <div className="field"><label>Подпись</label><input value={caption} onChange={(event) => setCaption(event.target.value)} /></div>
        <small>Для нескольких файлов номер добавится к alt-тексту автоматически.</small>
        {busy && <progress value={uploaded} max={selected.length}>{uploaded} из {selected.length}</progress>}
        <button className="button button-primary" type="button" disabled={busy || !selected.length || alt.trim().length < 3} onClick={() => void uploadSelected()}>
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
    {images.length ? <div className="photo-admin-grid">{images.map((image, index) => {
      const edit = { ...image, ...edits[image.id] };
      return <article className="photo-admin-card" key={image.id}>
        <div className="photo-admin-preview"><Image src={image.url} alt={image.alt} width={360} height={240} unoptimized={image.url.startsWith("/uploads/")} onError={() => console.error("House image preview failed to load", { imageId: image.id, src: image.url })} />{index === 0 && <span className="badge">Главное фото</span>}</div>
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
