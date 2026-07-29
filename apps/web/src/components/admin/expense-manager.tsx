"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AdminModal } from "@/components/admin/admin-modal";
import { formatCurrency } from "@/components/currency";

type ExpenseRow = {
  id: string;
  expenseDate: string;
  amount: string;
  categoryName: string;
  categoryColor: string;
  categoryId: string;
  houseId: string | null;
  houseName: string | null;
  employeeId: string | null;
  employeeName: string | null;
  comment: string | null;
  receiptFile: string | null;
  authorName: string;
};

type EmployeeOption = { id: string; fullName: string; status: string; isActive: boolean };

export function ExpenseManager({ rows, categories, houses, employees, canWrite, initialEmployeeId = "", lockEmployee = false, createLabel = "Добавить расход", exportQuery = "" }: {
  rows: ExpenseRow[];
  categories: Array<{ id: string; name: string }>;
  houses: Array<{ id: string; name: string }>;
  employees: EmployeeOption[];
  canWrite: boolean;
  initialEmployeeId?: string;
  lockEmployee?: boolean;
  createLabel?: string;
  exportQuery?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<"general" | "house">("general");
  const [editing, setEditing] = useState<ExpenseRow | null>(null);

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
          employeeId: form.get("employeeId") || null,
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
    {canWrite && <section className="panel"><h2>{createLabel}</h2>{message && <p className="notice" role="status">{message}</p>}<form className="form-stack" onSubmit={submit}>
      <div className="form-grid"><div className="field"><label>Дата</label><input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div><div className="field"><label>Сумма, BYN</label><input name="amount" type="number" min="0.01" step="0.01" required /></div><div className="field"><label>Статья</label><select name="expenseCategoryId" required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div></div>
      <div className="form-grid"><div className="field"><label>Тип</label><select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="general">Общий</option><option value="house">По домику</option></select></div>{type === "house" && <div className="field"><label>Домик</label><select name="houseId" required>{houses.map((house) => <option value={house.id} key={house.id}>{house.name}</option>)}</select></div>}<div className="field"><label>Сотрудник</label><select name="employeeId" defaultValue={initialEmployeeId} disabled={lockEmployee}><option value="">Не указан</option>{employees.filter((employee) => employee.isActive && ["working", "temporarily_inactive"].includes(employee.status) || employee.id === initialEmployeeId).map((employee) => <option value={employee.id} key={employee.id}>{employee.fullName}</option>)}</select>{lockEmployee && <input type="hidden" name="employeeId" value={initialEmployeeId} />}</div><div className="field"><label>Чек</label><input name="receipt" type="file" accept=".pdf,image/jpeg,image/png,image/webp" /></div></div>
      <div className="field"><label>Комментарий</label><textarea name="comment" maxLength={5000} /></div>
      <button className="button button-primary" disabled={saving}>{saving ? "Сохраняем…" : createLabel}</button>
    </form></section>}
    <section className="panel"><div className="section-heading compact-heading"><div><h2>Операции</h2></div><div className="button-row"><Link className="button button-ghost" href={`/api/admin/exports/expenses?format=xls${exportQuery ? `&${exportQuery}` : ""}`}>Excel</Link><Link className="button button-ghost" href={`/api/admin/exports/expenses?format=csv${exportQuery ? `&${exportQuery}` : ""}`}>CSV</Link><Link className="button button-ghost" href={`/api/admin/exports/expenses?format=pdf${exportQuery ? `&${exportQuery}` : ""}`}>PDF</Link></div></div>
      <table className="data-table"><thead><tr><th>Дата</th><th>Статья</th><th>Тип</th><th>Сумма</th><th>Сотрудник</th><th>Комментарий</th><th>Автор</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td data-label="Дата">{row.expenseDate}</td><td data-label="Статья"><span className="color-dot" style={{ background: row.categoryColor }} />{row.categoryName}</td><td data-label="Тип">{row.houseName ?? "Общий"}</td><td data-label="Сумма"><strong>{formatCurrency(Number(row.amount))}</strong></td><td data-label="Сотрудник">{row.employeeName ?? "Не указан"}</td><td data-label="Комментарий">{row.comment || "—"}{row.receiptFile && <><br /><a className="text-link" href={row.receiptFile} target="_blank" rel="noreferrer">Чек</a></>}</td><td data-label="Автор">{row.authorName}</td><td>{canWrite && <div className="action-row"><button className="button button-ghost" type="button" onClick={() => setEditing(row)}>Редактировать</button><button className="button button-ghost" type="button" onClick={() => remove(row.id)}>Удалить</button></div>}</td></tr>)}</tbody></table>
      {!rows.length && <p className="notice">Расходов за выбранный период нет.</p>}
    </section>
    {editing && <ExpenseEditor row={editing} categories={categories} houses={houses} employees={employees} onClose={() => setEditing(null)} />}
  </div>;
}

function ExpenseEditor({ row, categories, houses, employees, onClose }: {
  row: ExpenseRow;
  categories: Array<{ id: string; name: string }>;
  houses: Array<{ id: string; name: string }>;
  employees: EmployeeOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState({
    expenseDate: row.expenseDate,
    amount: row.amount,
    expenseCategoryId: row.categoryId,
    type: row.houseId ? "house" as const : "general" as const,
    houseId: row.houseId ?? "",
    employeeId: row.employeeId ?? "",
    comment: row.comment ?? ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch(`/api/admin/expenses/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, amount: Number(draft.amount), houseId: draft.houseId || null, employeeId: draft.employeeId || null })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(body.title ?? "Не удалось обновить расход");
    onClose();
    router.refresh();
  }
  return <AdminModal title="Редактирование расхода" onClose={onClose} busy={saving}><form className="form-stack" onSubmit={submit}>{message && <p className="notice error">{message}</p>}<div className="form-grid"><div className="field"><label>Дата</label><input type="date" value={draft.expenseDate} onChange={(event) => setDraft({ ...draft, expenseDate: event.target.value })} required /></div><div className="field"><label>Сумма, BYN</label><input type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} required /></div><div className="field"><label>Статья</label><select value={draft.expenseCategoryId} onChange={(event) => setDraft({ ...draft, expenseCategoryId: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div></div><div className="form-grid"><div className="field"><label>Тип</label><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as "general" | "house", houseId: event.target.value === "general" ? "" : draft.houseId })}><option value="general">Общий</option><option value="house">По домику</option></select></div>{draft.type === "house" && <div className="field"><label>Домик</label><select value={draft.houseId} onChange={(event) => setDraft({ ...draft, houseId: event.target.value })} required><option value="">Выберите</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></div>}<div className="field"><label>Сотрудник</label><select value={draft.employeeId} onChange={(event) => setDraft({ ...draft, employeeId: event.target.value })}><option value="">Не указан</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}{!employee.isActive || ["dismissed", "archived"].includes(employee.status) ? " · не работает" : ""}</option>)}</select></div></div><div className="field"><label>Комментарий</label><textarea value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} /></div><div className="modal-actions"><button className="button button-primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</button><button className="button button-ghost" type="button" onClick={onClose}>Отмена</button></div></form></AdminModal>;
}
