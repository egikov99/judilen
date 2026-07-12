"use client";

import Image from "next/image";
import { useRef, useState, type ChangeEvent } from "react";
import { createEntityImageUploadForm } from "@/lib/entity-image-upload";

export interface GazeboImageRow {
  id: string;
  gazeboId: string;
  url: string;
  alt: string;
  sortOrder: number;
}

function reportDevError(message: string, context: unknown) {
  if (process.env.NODE_ENV !== "production") console.error(message, context);
}

export function GazeboImagesManager({ gazeboId, initialImages }: {
  gazeboId: string;
  initialImages: GazeboImageRow[];
}) {
  const [images, setImages] = useState([...initialImages].sort((a, b) => a.sortOrder - b.sortOrder));
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? [...event.target.files] : [];
    if (!files.length) return;
    setUploading(true); setNotice("");
    try {
      const form = createEntityImageUploadForm(files, { key: "gazeboId", id: gazeboId });
      const response = await fetch(`/api/admin/gazebos/${gazeboId}/images`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(body.title ?? "Не удалось загрузить фотографии");
        return;
      }
      const created = Array.isArray(body.items) ? body.items as GazeboImageRow[] : [];
      setImages((items) => [...items, ...created].sort((a, b) => a.sortOrder - b.sortOrder));
      setNotice("Фотографии загружены");
    } catch (error) {
      reportDevError("Gazebo image upload failed", { gazeboId, error });
      setNotice("Не удалось загрузить фотографии");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function save(image: GazeboImageRow) {
    const response = await fetch(`/api/admin/gazebo-images/${image.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: image.alt })
    });
    if (!response.ok) return setNotice("Не удалось сохранить alt-текст");
    setNotice("Фотография сохранена");
  }

  async function remove(image: GazeboImageRow) {
    if (!confirm("Удалить фотографию беседки?")) return;
    const response = await fetch(`/api/admin/gazebo-images/${image.id}`, { method: "DELETE" });
    if (!response.ok) return setNotice("Не удалось удалить фотографию");
    setImages((items) => items.filter((item) => item.id !== image.id).map((item, index) => ({ ...item, sortOrder: index })));
    setNotice("Фотография удалена");
  }

  async function reorder(imageId: string, direction: -1 | 1) {
    const index = images.findIndex((image) => image.id === imageId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next.map((image, sortOrder) => ({ ...image, sortOrder })));
    const response = await fetch(`/api/admin/gazebos/${gazeboId}/images/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((image) => image.id) })
    });
    if (!response.ok) return setNotice("Не удалось изменить порядок");
    setNotice("Порядок фотографий обновлен");
  }

  return <section className="service-images-section">
    <div className="section-heading compact-heading"><div><span className="eyebrow">Медиа</span><h3>Фотографии беседки</h3></div></div>
    <p className="admin-section-description">Можно загрузить любое разумное количество файлов. Первое фото используется в карточке беседки.</p>
    <div className="field"><label>Загрузить фотографии</label><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={upload} /></div>
    {notice && <p className="notice" role="status">{notice}</p>}
    {images.length ? <div className="entity-image-grid">{images.map((image, index) => <article className="entity-image-card" key={image.id}>
      <Image src={image.url} alt={image.alt} width={360} height={240} unoptimized={image.url.startsWith("/uploads/")} onError={() => reportDevError("Gazebo image preview failed to load", { imageId: image.id, src: image.url })} />
      <div className="form-stack">
        <div className="field"><label>Alt-текст</label><input value={image.alt} onChange={(event) => setImages((items) => items.map((item) => item.id === image.id ? { ...item, alt: event.target.value } : item))} /></div>
        <div className="action-row"><button className="button button-ghost" type="button" onClick={() => reorder(image.id, -1)} disabled={index === 0}>Выше</button><button className="button button-ghost" type="button" onClick={() => reorder(image.id, 1)} disabled={index === images.length - 1}>Ниже</button><button className="button button-primary" type="button" onClick={() => save(image)}>Сохранить</button><button className="button button-ghost" type="button" onClick={() => remove(image)}>Удалить</button></div>
      </div>
    </article>)}</div> : <p className="notice">Фотографии беседки пока не загружены.</p>}
  </section>;
}
