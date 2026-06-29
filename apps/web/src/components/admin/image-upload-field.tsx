"use client";

import Image from "next/image";
import { useState } from "react";

export function ImageUploadField({ value, onChange, label = "Фотография" }: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  function selectFile(next: File | null) {
    setFile(next);
    if (!next) return setPreview("");
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result ?? ""));
    reader.readAsDataURL(next);
  }

  function upload() {
    if (!file) return;
    setError("");
    const form = new FormData();
    form.set("file", file);
    form.set("scope", "services");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/uploads");
    xhr.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round(event.loaded / event.total * 100));
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "{}");
      if (xhr.status < 200 || xhr.status >= 300) return setError(body.title ?? "Не удалось загрузить файл");
      onChange(body.url);
      selectFile(null);
      setProgress(0);
    };
    xhr.onerror = () => setError("Ошибка сети при загрузке");
    xhr.send(form);
  }

  return <div className="field">
    <label>{label}</label>
    <label className="upload-dropzone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
      event.preventDefault();
      selectFile(event.dataTransfer.files[0] ?? null);
    }}>
      <input className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
      {preview || value ? <Image src={preview || value} alt="Предпросмотр" width={240} height={150} unoptimized={preview.startsWith("data:")} /> : <span>Перетащите JPG, PNG или WebP либо выберите файл</span>}
    </label>
    {progress > 0 && <progress value={progress} max={100}>{progress}%</progress>}
    {error && <small className="error-text">{error}</small>}
    <div className="action-row">{file && <button className="button button-ghost" type="button" onClick={upload}>Загрузить</button>}{value && <button className="button button-ghost" type="button" onClick={() => onChange("")}>Удалить фото</button>}</div>
  </div>;
}
