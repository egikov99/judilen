"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImageRow {
  id: string; houseId: string; url: string; alt: string; caption: string | null;
  position: number; isMain: boolean; isActive: boolean;
}

export function HouseImagesManager({ houseId, images }: { houseId: string; images: ImageRow[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<ImageRow>>>({});
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  function selectFile(next: File | null) {
    setFile(next);
    if (!next) return setPreview("");
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(next);
  }

  function upload(selectedFile = file, replace?: ImageRow) {
    if (!selectedFile) return;
    setMessage("");
    const current = replace ? { ...replace, ...edits[replace.id] } : null;
    const form = new FormData();
    form.set("file", selectedFile);
    form.set("scope", "houses");
    form.set("houseId", houseId);
    form.set("alt", current?.alt || alt);
    form.set("caption", current?.caption || caption);
    form.set("position", String(current?.position ?? images.length));
    form.set("isMain", String(current?.isMain ?? !images.length));
    form.set("isActive", String(current?.isActive ?? true));
    if (replace) form.set("imageId", replace.id);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round(event.loaded / event.total * 100));
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "{}");
      if (xhr.status < 200 || xhr.status >= 300) {
        console.error("House image upload failed", { status: xhr.status, response: body });
        return setMessage(body.title ?? "Не удалось загрузить фото");
      }
      selectFile(null); setAlt(""); setCaption(""); setProgress(0); router.refresh();
    };
    xhr.onerror = () => {
      console.error("House image upload failed because of a network error", { houseId });
      setMessage("Ошибка сети при загрузке");
    };
    xhr.send(form);
  }

  async function save(image: ImageRow) {
    const response = await fetch(`/api/admin/house-images/${image.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: next.map((image) => image.id) })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось изменить порядок фотографий");
    router.refresh();
  }

  return <section className="panel house-photo-panel">
    <h2>Фотографии</h2>
    {message && <div className="notice error">{message}</div>}
    <div className="photo-upload-form">
      <label className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0] ?? null); }}>
        <input className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
        {preview ? <Image src={preview} alt="Предпросмотр нового фото" width={320} height={200} unoptimized /> : <span>Перетащите фото сюда или выберите файл</span>}
      </label>
      <div className="form-stack">
        <div className="field"><label>Alt-текст</label><input value={alt} onChange={(event) => setAlt(event.target.value)} required /></div>
        <div className="field"><label>Подпись</label><input value={caption} onChange={(event) => setCaption(event.target.value)} /></div>
        <small>Главным будет первое фото в списке. Порядок можно изменить после загрузки.</small>
        {progress > 0 && <progress value={progress} max={100}>{progress}%</progress>}
        <button className="button button-primary" type="button" disabled={!file || alt.trim().length < 3} onClick={() => upload()}>Загрузить фото</button>
      </div>
    </div>
    {images.length ? <div className="photo-admin-grid">{images.map((image, index) => {
      const edit = { ...image, ...edits[image.id] };
      return <article className="photo-admin-card" key={image.id}>
        <div className="photo-admin-preview"><Image src={image.url} alt={image.alt} width={360} height={240} unoptimized={image.url.startsWith("/uploads/")} onError={() => console.error("House image preview failed to load", { imageId: image.id, src: image.url })} />{index === 0 && <span className="badge">Главное фото</span>}</div>
        <div className="form-stack">
          <div className="field"><label>Alt-текст</label><input value={edit.alt} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, alt: event.target.value } }))} /></div>
          <div className="field"><label>Подпись</label><input value={edit.caption ?? ""} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, caption: event.target.value } }))} /></div>
          <label><input type="checkbox" checked={edit.isActive} onChange={(event) => setEdits((value) => ({ ...value, [image.id]: { ...edit, isActive: event.target.checked } }))} /> Активно</label>
          <div className="action-row"><button className="icon-button" title="Переместить назад" disabled={index === 0} onClick={() => move(index, -1)}>↑</button><button className="icon-button" title="Переместить вперёд" disabled={index === images.length - 1} onClick={() => move(index, 1)}>↓</button><label className="button button-ghost">Заменить<input className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(event) => event.target.files?.[0] && upload(event.target.files[0], image)} /></label></div>
          <div className="action-row"><button className="button button-primary" onClick={() => save(image)}>Сохранить</button><button className="button button-ghost" onClick={() => remove(image.id)}>Удалить</button></div>
        </div>
      </article>;
    })}</div> : <p className="notice">Фотографии пока не загружены. На публичном сайте будет показан placeholder.</p>}
  </section>;
}
