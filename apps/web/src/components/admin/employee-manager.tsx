"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AdminModal } from "@/components/admin/admin-modal";
import { formatCurrency } from "@/components/currency";
import { employeeStatusLabels, employeeStatuses, type EmployeeRow, type EmployeeStatus } from "@/lib/employee-types";

export type EmployeeUserOption = {
  id: string;
  name: string;
  email: string;
  linkedEmployeeId: string | null;
};

const emptyEmployee = {
  fullName: "",
  position: "",
  phone: "",
  email: "",
  birthDate: "",
  startDate: "",
  endDate: "",
  status: "working" as EmployeeStatus,
  comment: "",
  personnelNumber: "",
  userId: "",
  isActive: true
};

function EmployeeEditor({ employee, users, onClose }: {
  employee: EmployeeRow | null;
  users: EmployeeUserOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => employee ? {
    fullName: employee.fullName,
    position: employee.position ?? "",
    phone: employee.phone ?? "",
    email: employee.email ?? "",
    birthDate: employee.birthDate ?? "",
    startDate: employee.startDate ?? "",
    endDate: employee.endDate ?? "",
    status: employee.status,
    comment: employee.comment ?? "",
    personnelNumber: employee.personnelNumber ?? "",
    userId: employee.userId ?? "",
    isActive: employee.isActive
  } : emptyEmployee);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch(employee ? `/api/admin/employees/${employee.id}` : "/api/admin/employees", {
      method: employee ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить сотрудника");
    onClose();
    router.refresh();
  }

  const availableUsers = users.filter((user) => !user.linkedEmployeeId || user.linkedEmployeeId === employee?.id);
  return <AdminModal title={employee ? "Редактирование сотрудника" : "Новый сотрудник"} onClose={onClose} busy={saving}>
    <form className="form-stack" onSubmit={submit}>
      {message && <p className="notice error" role="status">{message}</p>}
      <h3>Основная информация</h3>
      <div className="field"><label>ФИО</label><input autoFocus value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} required /></div>
      <div className="form-grid"><div className="field"><label>Должность</label><input value={draft.position} onChange={(event) => setDraft({ ...draft, position: event.target.value })} /></div><div className="field"><label>Статус</label><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as EmployeeStatus })}>{employeeStatuses.map((status) => <option key={status} value={status}>{employeeStatusLabels[status]}</option>)}</select></div></div>
      <div className="form-grid"><div className="field"><label>Телефон</label><input type="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div><div className="field"><label>Email</label><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></div></div>
      <div className="form-grid"><div className="field"><label>Дата рождения</label><input type="date" value={draft.birthDate} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></div><div className="field"><label>Дата начала работы</label><input type="date" value={draft.startDate} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} /></div><div className="field"><label>Дата окончания работы</label><input type="date" value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })} /></div></div>
      <div className="field"><label>Внутренний комментарий</label><textarea value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} /></div>
      <h3>Дополнительная информация</h3>
      <div className="form-grid"><div className="field"><label>Табельный номер</label><input value={draft.personnelNumber} onChange={(event) => setDraft({ ...draft, personnelNumber: event.target.value })} /></div><div className="field"><label>Учетная запись пользователя</label><select value={draft.userId} onChange={(event) => setDraft({ ...draft, userId: event.target.value })}><option value="">Не связана</option>{availableUsers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></div></div>
      <label className="field-check"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Активен</label>
      <div className="modal-actions"><button className="button button-primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</button><button className="button button-ghost" type="button" disabled={saving} onClick={onClose}>Отмена</button></div>
    </form>
  </AdminModal>;
}

export function EmployeeManager({ rows, users, canWrite }: {
  rows: EmployeeRow[];
  users: EmployeeUserOption[];
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState<EmployeeRow | null | undefined>(undefined);
  return <>
    <section className="panel">
      <div className="section-heading compact-heading"><div><h2>Список сотрудников</h2></div>{canWrite && <button className="button button-primary" type="button" onClick={() => setEditing(null)}>Добавить сотрудника</button>}</div>
      {rows.length ? <div className="booking-services-table-wrap"><table className="data-table"><thead><tr><th>ФИО</th><th>Должность</th><th>Телефон</th><th>Email</th><th>Статус</th><th>Начало работы</th><th>Расходы за период</th><th /></tr></thead><tbody>{rows.map((employee) => <tr key={employee.id}>
        <td data-label="ФИО"><Link className="text-link" href={`/admin/employees/${employee.id}`}><strong>{employee.fullName}</strong></Link>{employee.personnelNumber && <><br /><small>№ {employee.personnelNumber}</small></>}</td>
        <td data-label="Должность">{employee.position || "—"}</td>
        <td data-label="Телефон">{employee.phone || "—"}</td>
        <td data-label="Email">{employee.email || "—"}</td>
        <td data-label="Статус"><span className={`badge ${employee.status === "working" && employee.isActive ? "" : "badge-warn"}`}>{employeeStatusLabels[employee.status]}</span></td>
        <td data-label="Начало работы">{employee.startDate || "—"}</td>
        <td data-label="Расходы за период"><strong>{formatCurrency(employee.expenseTotal)}</strong></td>
        <td data-label="Действия"><div className="action-row"><Link className="button button-ghost" href={`/admin/employees/${employee.id}`}>Открыть</Link>{canWrite && <button className="button button-ghost" type="button" onClick={() => setEditing(employee)}>Редактировать</button>}</div></td>
      </tr>)}</tbody></table></div> : <div className="notice"><p>Сотрудники пока не добавлены.</p>{canWrite && <button className="button button-primary" type="button" onClick={() => setEditing(null)}>Добавить сотрудника</button>}</div>}
    </section>
    {editing !== undefined && <EmployeeEditor employee={editing} users={users} onClose={() => setEditing(undefined)} />}
  </>;
}

export function EmployeeDetailsEditor({ employee, users }: { employee: EmployeeRow; users: EmployeeUserOption[] }) {
  const [open, setOpen] = useState(false);
  return <>{<button className="button button-ghost" type="button" onClick={() => setOpen(true)}>Редактировать</button>}{open && <EmployeeEditor employee={employee} users={users} onClose={() => setOpen(false)} />}</>;
}
