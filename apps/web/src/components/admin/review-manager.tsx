"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type Source = "manual" | "site" | "google" | "booking" | "airbnb";
type ReviewStatus = "pending" | "published" | "rejected";
interface ReviewRow {
  id: string;
  customerName: string;
  customerEmail: string | null;
  rating: number;
  text: string;
  houseId: string | null;
  bookingId: string | null;
  isPublished: boolean;
  status: ReviewStatus;
  source: Source;
}
interface HouseRow { id: string; name: string }

const emptyReview: Omit<ReviewRow, "id"> & { id?: string } = {
  customerName: "", customerEmail: "", rating: 5, text: "", houseId: null, bookingId: null,
  isPublished: true, status: "published", source: "manual"
};
const statusLabels: Record<ReviewStatus, string> = {
  pending: "На модерации", published: "Опубликован", rejected: "Отклонён"
};

export function ReviewManager({ reviews, houses }: {
  reviews: Array<{ review: ReviewRow; houseName: string | null }>;
  houses: HouseRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState(emptyReview);
  const [message, setMessage] = useState("");

  function setFilter(name: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(name, value); else params.delete(name);
    router.push(`/admin/reviews?${params.toString()}`);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(editing.id ? `/api/admin/reviews/${editing.id}` : "/api/admin/reviews", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editing,
        isPublished: editing.status === "published",
        customerEmail: editing.customerEmail || null,
        houseId: editing.houseId || null,
        bookingId: editing.bookingId || null
      })
    });
    const body = await response.json();
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить отзыв");
    setEditing(emptyReview);
    router.refresh();
  }

  async function moderate(id: string, status: ReviewStatus) {
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status })
    });
    router.refresh();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return <div className="form-stack">
    {message && <div className="notice error">{message}</div>}
    <section className="panel">
      <h2>{editing.id ? "Редактирование отзыва" : "Новый отзыв"}</h2>
      <form className="form-stack" onSubmit={save}>
        <div className="form-grid"><div className="field"><label>Имя</label><input value={editing.customerName} onChange={(event) => setEditing({ ...editing, customerName: event.target.value })} required /></div><div className="field"><label>Email</label><input type="email" value={editing.customerEmail ?? ""} onChange={(event) => setEditing({ ...editing, customerEmail: event.target.value })} /></div></div>
        <div className="form-grid"><div className="field"><label>Домик</label><select value={editing.houseId ?? ""} onChange={(event) => setEditing({ ...editing, houseId: event.target.value || null })}><option value="">Без домика</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></div><div className="field"><label>Рейтинг</label><select value={editing.rating} onChange={(event) => setEditing({ ...editing, rating: Number(event.target.value) })}>{[5, 4, 3, 2, 1].map((rating) => <option key={rating}>{rating}</option>)}</select></div></div>
        <div className="field"><label>Текст</label><textarea value={editing.text} onChange={(event) => setEditing({ ...editing, text: event.target.value })} required /></div>
        <div className="form-grid"><div className="field"><label>Источник</label><select value={editing.source} onChange={(event) => setEditing({ ...editing, source: event.target.value as Source })}>{["manual", "site", "google", "booking", "airbnb"].map((source) => <option key={source}>{source}</option>)}</select></div><div className="field"><label>Статус</label><select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as ReviewStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></div>
        <button className="button button-primary">Сохранить</button>
      </form>
    </section>
    <section className="panel">
      <div className="form-grid" style={{ marginBottom: 18 }}><div className="field"><label>Домик</label><select defaultValue={searchParams.get("houseId") ?? ""} onChange={(event) => setFilter("houseId", event.target.value)}><option value="">Все</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></div><div className="field"><label>Рейтинг</label><select defaultValue={searchParams.get("rating") ?? ""} onChange={(event) => setFilter("rating", event.target.value)}><option value="">Все</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating}>{rating}</option>)}</select></div><div className="field"><label>Источник</label><select defaultValue={searchParams.get("source") ?? ""} onChange={(event) => setFilter("source", event.target.value)}><option value="">Все</option>{["manual", "site", "google", "booking", "airbnb"].map((source) => <option key={source}>{source}</option>)}</select></div></div>
      <table className="data-table"><thead><tr><th>Гость</th><th>Отзыв</th><th>Рейтинг</th><th>Источник</th><th>Статус</th><th /></tr></thead><tbody>{reviews.map(({ review, houseName }) => <tr key={review.id}>
        <td data-label="Гость"><strong>{review.customerName}</strong><br /><small>{houseName ?? "Без домика"}</small></td><td data-label="Отзыв">{review.text}</td><td data-label="Рейтинг">{review.rating}</td><td data-label="Источник">{review.source}</td><td data-label="Статус"><span className={`badge ${review.status === "published" ? "" : "badge-warn"}`}>{statusLabels[review.status]}</span></td>
        <td data-label=""><div className="action-row">{review.status !== "published" && <button className="button button-ghost" onClick={() => moderate(review.id, "published")}>Опубликовать</button>}{review.status !== "rejected" && <button className="button button-ghost" onClick={() => moderate(review.id, "rejected")}>Отклонить</button>}<button className="button button-ghost" onClick={() => setEditing(review)}>Редактировать</button><button className="button button-ghost" onClick={() => remove(review.id)}>Удалить</button></div></td>
      </tr>)}</tbody></table>
      {!reviews.length && <p className="notice">Отзывов пока нет.</p>}
    </section>
  </div>;
}
