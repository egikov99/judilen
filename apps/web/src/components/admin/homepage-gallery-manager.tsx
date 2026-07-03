"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface GalleryImage {
  id: string;
  imageUrl: string;
  alt: string;
  sortOrder: number;
}

type SelectedImage = { file: File; preview: string };

export function HomepageGalleryManager({ images }: { images: GalleryImage[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [alt, setAlt] = useState("Территория и отдых в усадьбе «Юдилен»");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(0);

  async function selectFiles(files: FileList | File[]) {
    const next = await Promise.all(Array.from(files).map((file) => new Promise<SelectedImage>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ file, preview: String(reader.result ?? "") });
      reader.readAsDataURL(file);
    })));
    setSelected((current) => [...current, ...next]);
  }

  async function upload() {
    if (!selected.length || alt.trim().length < 2) return;
    setBusy(true);
    setMessage("");
    setUploaded(0);
    let completed = 0;
    try {
      for (const [index, image] of selected.entries()) {
        const form = new FormData();
        form.set("file", image.file);
        form.set("sectionKey", "territory");
        form.set("alt", selected.length > 1 ? `${alt.trim()}, фото ${index + 1}` : alt.trim());
        const response = await fetch("/api/admin/homepage-gallery", { method: "POST", body: form });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.title ?? `Не удалось загрузить ${image.file.name}`);
        completed = index + 1;
        setUploaded(index + 1);
      }
      setSelected([]);
      router.refresh();
    } catch (error) {
      console.error("Homepage gallery upload failed", { error });
      setSelected((items) => items.slice(completed));
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить фотографии");
      if (completed > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveAlt(image: GalleryImage) {
    setMessage("");
    const response = await fetch(`/api/admin/homepage-gallery/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: edits[image.id] ?? image.alt })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить alt-текст");
    router.refresh();
  }

  async function remove(id: string) {
    setMessage("");
    const response = await fetch(`/api/admin/homepage-gallery/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось удалить фотографию");
    router.refresh();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setMessage("");
    const response = await fetch("/api/admin/homepage-gallery/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionKey: "territory", imageIds: next.map((image) => image.id) })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось изменить порядок фотографий");
    router.refresh();
  }

  return (
    <section className="panel homepage-gallery-panel">
      <h2>Галерея «Территория и отдых»</h2>
      <p className="admin-section-description">Первое фото отображается главным на главной странице. Количество фотографий не ограничено.</p>
      {message && <div className="notice error">{message}</div>}
      <div className="photo-upload-form">
        <label
          className="upload-dropzone homepage-gallery-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!busy) void selectFiles(event.dataTransfer.files);
          }}
        >
          <input
            className="visually-hidden"
            type="file"
            multiple
            disabled={busy}
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(event) => event.target.files && void selectFiles(event.target.files)}
          />
          <span>Перетащите фотографии сюда или выберите файлы</span>
        </label>
        <div className="form-stack">
          <div className="field">
            <label>Alt-текст</label>
            <input value={alt} onChange={(event) => setAlt(event.target.value)} required />
          </div>
          <small>JPEG, PNG или WebP. Для нескольких файлов номер добавится к alt-тексту автоматически.</small>
          {busy && <progress value={uploaded} max={selected.length}>{uploaded} из {selected.length}</progress>}
          <button className="button button-primary" type="button" disabled={busy || !selected.length || alt.trim().length < 2} onClick={() => void upload()}>
            {busy ? `Загружено ${uploaded} из ${selected.length}` : `Загрузить${selected.length ? ` (${selected.length})` : ""}`}
          </button>
        </div>
      </div>
      {selected.length > 0 && (
        <div className="homepage-gallery-selection" aria-label="Предпросмотр выбранных фотографий">
          {selected.map((image, index) => (
            <div className="homepage-gallery-selection-item" key={`${image.file.name}-${image.file.lastModified}-${index}`}>
              <Image src={image.preview} alt={`Предпросмотр ${image.file.name}`} width={180} height={120} unoptimized />
              <button type="button" aria-label={`Убрать ${image.file.name}`} onClick={() => setSelected((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button>
            </div>
          ))}
        </div>
      )}
      {images.length ? (
        <div className="photo-admin-grid">
          {images.map((image, index) => (
            <article className="photo-admin-card" key={image.id}>
              <div className="photo-admin-preview">
                <Image
                  src={image.imageUrl}
                  alt={image.alt}
                  width={360}
                  height={240}
                  unoptimized={image.imageUrl.startsWith("/uploads/")}
                  onError={() => console.error("Homepage gallery preview failed to load", { imageId: image.id, src: image.imageUrl })}
                />
                {index === 0 && <span className="badge">Главное фото</span>}
              </div>
              <div className="form-stack">
                <div className="field">
                  <label>Alt-текст</label>
                  <input value={edits[image.id] ?? image.alt} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: event.target.value }))} />
                </div>
                <div className="action-row">
                  <button className="icon-button" type="button" title="Переместить назад" disabled={index === 0} onClick={() => void move(index, -1)}>↑</button>
                  <button className="icon-button" type="button" title="Переместить вперёд" disabled={index === images.length - 1} onClick={() => void move(index, 1)}>↓</button>
                  <button className="button button-primary" type="button" onClick={() => void saveAlt(image)}>Сохранить</button>
                  <button className="button button-ghost" type="button" onClick={() => void remove(image.id)}>Удалить</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="notice">Фотографии пока не загружены. На сайте показывается текущая fallback-фотография.</p>
      )}
    </section>
  );
}
