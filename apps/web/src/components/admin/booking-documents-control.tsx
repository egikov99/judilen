"use client";

import { useState, type FormEvent } from "react";

type DocumentRow = { id: string; title: string; mimeType: string; createdAt: string };

export function BookingDocumentsControl({ bookingId, canUpload }: { bookingId: string; canUpload: boolean }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [message, setMessage] = useState("");
  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      const response = await fetch(`/api/admin/bookings/${bookingId}/documents`);
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setDocuments(body.items.map((item: DocumentRow & { createdAt: string | Date }) => ({ ...item, createdAt: String(item.createdAt) })));
        setLoaded(true);
      }
    }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/bookings/${bookingId}/documents`, { method: "POST", body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось загрузить документ");
    setDocuments((current) => [...current, { ...body.item, createdAt: String(body.item.createdAt) }]);
    event.currentTarget.reset();
  }
  async function remove(id: string) {
    const response = await fetch(`/api/admin/booking-documents/${id}`, { method: "DELETE" });
    if (response.ok) setDocuments((current) => current.filter((document) => document.id !== id));
  }
  return <div className="booking-documents-control"><button className="button button-ghost" type="button" onClick={toggle}>Документы</button>{open && <div className="booking-documents-popover">{message && <p className="notice error">{message}</p>}{documents.map((document) => <div className="summary-row" key={document.id}><a className="text-link" href={`/api/admin/booking-documents/${document.id}`} target="_blank">{document.title}</a>{canUpload && <button type="button" className="button button-ghost" onClick={() => remove(document.id)}>×</button>}</div>)}{!documents.length && <p className="notice">Документов нет.</p>}{canUpload && <form className="form-stack" onSubmit={upload}><div className="field"><label>Название</label><input name="title" maxLength={200} required /></div><div className="field"><label>Файл</label><input name="file" type="file" accept=".pdf,image/jpeg,image/png,image/webp" required /></div><button className="button button-primary">Загрузить</button></form>}</div>}</div>;
}
