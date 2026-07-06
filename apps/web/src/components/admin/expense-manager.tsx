"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { formatCurrency } from "@/components/currency";

type ExpenseRow = {
  id: string;
  expenseDate: string;
  amount: string;
  categoryName: string;
  categoryColor: string;
  houseName: string | null;
  comment: string | null;
  receiptFile: string | null;
  authorName: string;
};

export function ExpenseManager({ rows, categories, houses, canWrite }: {
  rows: ExpenseRow[];
  categories: Array<{ id: string; name: string }>;
  houses: Array<{ id: string; name: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"general" | "house">("general");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      let receiptFile: string | null = null;
      const receipt = form.get("receipt");
      if (receipt instanceof File && receipt.size) {
        const upload = new FormData();
        upload.append("file", receipt);
        const uploadResponse = await fetch("/api/admin/expenses/receipts", { method: "POST", body: upload });
        const uploadBody = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploadBody.title ?? "Не удалось загрузить чек");
        receiptFile = uploadBody.url;
      }
      const response = await fetch("/api/admin/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseDate: form.get("expenseDate"),
          amount: Number(form.get("amount")),
          expenseCategoryId: form.get("expenseCategoryId"),
          type,
          houseId: type === "house" ? form.get("houseId") : null,
          comment: form.get("comment"),
          receiptFile
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.title ?? "Не удалось сохранить расход");
      event.currentTarget.reset();
      setType("general");
      setMessage("Расход добавлен");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось сохранить расход");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const response = await fetch(`/api/admin/expenses/${id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setMessage(response.ok ? "Расход удалён" : body.title ?? "Не удалось удалить");
    if (response.ok) router.refresh();
  }

  return <div className="form-stack">
    {canWrite && <section className="panel"><h2>Добавить расход</h2>{message && <p className="notice" role="status">{message}</p>}<form className="form-stack" onSubmit={submit}>
      <div className="form-grid"><div className="field"><label>Дата</label><input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div><div className="field"><label>Сумма, BYN</label><input name="amount" type="number" min="0.01" step="0.01" required /></div><div className="field"><label>Статья</label><select name="expenseCategoryId" required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div></div>
      <div className="form-grid"><div className="field"><label>Тип</label><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="general">Общий</option><option value="house">По домику</option></select></div>{type === "house" && <div className="field"><label>Домик</label><select name="houseId" required>{houses.map((house) => <option value={house.id} key={house.id}>{house.name}</option>)}</select></div>}<div className="field"><label>Чек</label><input name="receipt" type="file" accept=".pdf,image/jpeg,image/png,image/webp" /></div></div>
      <div className="field"><label>Комментарий</label><textarea name="comment" maxLength={5000} /></div>
      <button className="button button-primary" disabled={saving}>{saving ? "Сохраняем…" : "Добавить расход"}</button>
    </form></section>}
    <section className="panel"><div className="section-heading compact-heading"><div><h2>Операции</h2></div><div className="button-row"><Link className="button button-ghost" href="/api/admin/exports/expenses?format=xls">Excel</Link><Link className="button button-ghost" href="/api/admin/exports/expenses?format=csv">CSV</Link><Link className="button button-ghost" href="/api/admin/exports/expenses?format=pdf">PDF</Link></div></div>
      <table className="data-table"><thead><tr><th>Дата</th><th>Статья</th><th>Тип</th><th>Сумма</th><th>Сотрудник</th><th>Комментарий</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td data-label="Дата">{row.expenseDate}</td><td data-label="Статья"><span className="color-dot" style={{ background: row.categoryColor }} />{row.categoryName}</td><td data-label="Тип">{row.houseName ?? "Общий"}</td><td data-label="Сумма"><strong>{formatCurrency(Number(row.amount))}</strong></td><td data-label="Сотрудник">{row.authorName}</td><td data-label="Комментарий">{row.comment || "—"}{row.receiptFile && <><br /><a className="text-link" href={row.receiptFile} target="_blank">Чек</a></>}</td><td>{canWrite && <button className="button button-ghost" type="button" onClick={() => remove(row.id)}>Удалить</button>}</td></tr>)}</tbody></table>
      {!rows.length && <p className="notice">Расходов за выбранный период нет.</p>}
    </section>
  </div>;
}
