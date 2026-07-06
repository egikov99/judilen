"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Note = { id: string; text: string; authorName: string; createdAt: string; updatedAt: string };

export function ClientNotesManager({ clientId, initialNotes, canWrite }: {
  clientId: string;
  initialNotes: Note[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/customers/${clientId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: form.get("text") })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить");
    event.currentTarget.reset();
    setMessage("Заметка добавлена");
    router.refresh();
  }
  async function update(note: Note, text: string) {
    const response = await fetch(`/api/admin/client-notes/${note.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить");
    setNotes((current) => current.map((item) => item.id === note.id ? { ...item, text, updatedAt: new Date().toISOString() } : item));
  }
  async function remove(id: string) {
    const response = await fetch(`/api/admin/client-notes/${id}`, { method: "DELETE" });
    if (response.ok) setNotes((current) => current.filter((note) => note.id !== id));
  }
  return <section className="panel"><h2>Комментарии администратора</h2><p className="admin-subtitle">Внутренние заметки — клиент их не видит.</p>{message && <p className="notice">{message}</p>}{canWrite && <form className="form-stack" onSubmit={create}><div className="field"><label>Новая заметка</label><textarea name="text" required maxLength={10_000} /></div><button className="button button-primary">Добавить</button></form>}<div className="note-list">{notes.map((note) => <NoteRow key={note.id} note={note} canWrite={canWrite} onUpdate={update} onDelete={remove} />)}</div>{!notes.length && <p className="notice">Заметок нет.</p>}</section>;
}

function NoteRow({ note, canWrite, onUpdate, onDelete }: { note: Note; canWrite: boolean; onUpdate: (note: Note, text: string) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [text, setText] = useState(note.text);
  const [history, setHistory] = useState<Array<{ id: string; text: string; createdAt: string }> | null>(null);
  async function loadHistory() {
    if (history) return setHistory(null);
    const response = await fetch(`/api/admin/client-notes/${note.id}/revisions`);
    const body = await response.json().catch(() => ({}));
    if (response.ok) setHistory(body.items);
  }
  return <article className="client-note"><div className="client-note-meta"><strong>{note.authorName}</strong><time>{new Date(note.createdAt).toLocaleString("ru-RU")}</time>{note.updatedAt !== note.createdAt && <span>изменено</span>}</div>{canWrite ? <textarea value={text} onChange={(event) => setText(event.target.value)} /> : <p>{text}</p>}<div className="button-row"><button className="button button-ghost" type="button" onClick={loadHistory}>{history ? "Скрыть историю" : "История изменений"}</button>{canWrite && <><button className="button button-primary" type="button" onClick={() => onUpdate(note, text)}>Сохранить</button><button className="button button-ghost" type="button" onClick={() => onDelete(note.id)}>Удалить</button></>}</div>{history && <div className="note-history">{history.map((revision) => <div key={revision.id}><time>{new Date(revision.createdAt).toLocaleString("ru-RU")}</time><p>{revision.text}</p></div>)}</div>}</article>;
}
