"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Note = { id: string; text: string; authorName: string; createdAt: string; updatedAt: string };

type Feedback = { type: "success" | "error"; text: string } | null;

export function ClientNotesManager({ clientId, initialNotes, canWrite }: {
  clientId: string;
  initialNotes: Note[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [text, setText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) {
      setFeedback({ type: "error", text: "Введите текст комментария" });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/customers/${clientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = body.title ?? body.message ?? "Не удалось сохранить комментарий";
        console.error("Failed to save client note", { status: response.status, body });
        setFeedback({ type: "error", text: message });
        return;
      }

      const item = body.item;
      if (item) {
        setNotes((current) => [{
          id: item.id,
          text: item.text,
          authorName: item.authorName ?? "Вы",
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }, ...current]);
      }

      setText("");
      setFeedback({ type: "success", text: "Комментарий сохранён" });
      router.refresh();
    } catch (error) {
      console.error("Failed to save client note", error);
      setFeedback({ type: "error", text: "Не удалось сохранить комментарий" });
    } finally {
      setIsSaving(false);
    }
  }
  async function update(note: Note, text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setFeedback({ type: "error", text: "Комментарий не может быть пустым" });
      return;
    }
    if (trimmed === note.text.trim()) {
      setFeedback({ type: "success", text: "Комментарий не изменён" });
      return;
    }

    const response = await fetch(`/api/admin/client-notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.title ?? body.message ?? "Не удалось сохранить комментарий";
      console.error("Failed to update client note", { status: response.status, body });
      setFeedback({ type: "error", text: message });
      return;
    }

    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, text: trimmed, updatedAt: new Date().toISOString() } : item));
    setFeedback({ type: "success", text: "Комментарий обновлён" });
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/client-notes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error("Failed to delete client note", { status: response.status, body });
      setFeedback({ type: "error", text: body.title ?? body.message ?? "Не удалось удалить комментарий" });
      return;
    }

    setNotes((current) => current.filter((note) => note.id !== id));
    setFeedback({ type: "success", text: "Комментарий удалён" });
  }

  return <section className="panel"><h2>Комментарии администратора</h2><p className="admin-subtitle">Внутренние заметки — клиент их не видит.</p>{feedback && <p className={`notice${feedback.type === "error" ? " error" : ""}`} role={feedback.type === "error" ? "alert" : "status"} aria-live="polite">{feedback.text}</p>}{canWrite && <form className="form-stack" onSubmit={create}><div className="field"><label htmlFor="new-client-note">Новая заметка</label><textarea id="new-client-note" name="text" value={text} onChange={(event) => setText(event.currentTarget.value)} required maxLength={10_000} disabled={isSaving} /></div><button className="button button-primary" type="submit" disabled={isSaving || !text.trim()} aria-busy={isSaving}>{isSaving ? "Сохранение…" : "Добавить"}</button></form>}<div className="note-list">{notes.map((note) => <NoteRow key={note.id} note={note} canWrite={canWrite} onUpdate={update} onDelete={remove} />)}</div>{!notes.length && <p className="notice">Заметок нет.</p>}</section>;
}

function NoteRow({ note, canWrite, onUpdate, onDelete }: { note: Note; canWrite: boolean; onUpdate: (note: Note, text: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [text, setText] = useState(note.text);
  const [history, setHistory] = useState<Array<{ id: string; text: string; createdAt: string }> | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadHistory() {
    if (history) return setHistory(null);
    const response = await fetch(`/api/admin/client-notes/${note.id}/revisions`);
    const body = await response.json().catch(() => ({}));
    if (response.ok) setHistory(body.items);
  }

  async function handleUpdate() {
    setIsUpdating(true);
    await onUpdate(note, text);
    setIsUpdating(false);
  }

  async function handleDelete() {
    if (!confirm("Удалить этот комментарий?")) return;
    setIsDeleting(true);
    await onDelete(note.id);
    setIsDeleting(false);
  }

  return <article className="client-note"><div className="client-note-meta"><strong>{note.authorName}</strong><time>{new Date(note.createdAt).toLocaleString("ru-RU")}</time>{note.updatedAt !== note.createdAt && <span>изменено</span>}</div>{canWrite ? <textarea value={text} onChange={(event) => setText(event.currentTarget.value)} disabled={isUpdating || isDeleting} /> : <p>{text}</p>}<div className="button-row"><button className="button button-ghost" type="button" onClick={loadHistory}>{history ? "Скрыть историю" : "История изменений"}</button>{canWrite && <><button className="button button-primary" type="button" onClick={handleUpdate} disabled={isUpdating || isDeleting} aria-busy={isUpdating}>{isUpdating ? "Сохранение…" : "Сохранить"}</button><button className="button button-ghost" type="button" onClick={handleDelete} disabled={isDeleting || isUpdating} aria-busy={isDeleting}>{isDeleting ? "Удаление…" : "Удалить"}</button></>}</div>{history && <div className="note-history">{history.map((revision) => <div key={revision.id}><time>{new Date(revision.createdAt).toLocaleString("ru-RU")}</time><p>{revision.text}</p></div>)}</div>}</article>;
}
