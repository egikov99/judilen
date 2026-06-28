"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContentCreateForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title"));
    const response = await fetch("/api/admin/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: form.get("slug"),
        title,
        content: { body: form.get("body") },
        seoTitle: form.get("seoTitle"),
        seoDescription: form.get("seoDescription"),
        isPublished: form.get("isPublished") === "on"
      })
    });
    const payload = await response.json();
    if (!response.ok) return setError(payload.title ?? "Не удалось сохранить");
    event.currentTarget.reset();
    setError("");
    router.refresh();
  }
  return <form className="form-stack" onSubmit={submit}>{error && <div className="notice error">{error}</div>}<div className="form-grid"><div className="field"><label>Заголовок</label><input name="title" required /></div><div className="field"><label>Slug</label><input name="slug" pattern="[a-z0-9-]+" required /></div></div><div className="field"><label>Текст</label><textarea name="body" required /></div><div className="field"><label>SEO title</label><input name="seoTitle" minLength={10} maxLength={70} required /></div><div className="field"><label>SEO description</label><textarea name="seoDescription" minLength={30} maxLength={180} required /></div><label><input name="isPublished" type="checkbox" /> Опубликована</label><button className="button button-primary">Создать страницу</button></form>;
}

