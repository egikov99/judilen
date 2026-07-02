"use client";

import { useMemo, useState } from "react";
import type { Permission, Role } from "@judilen/auth";
import { AdminModal } from "@/components/admin/admin-modal";

type UserRow = {
  id: string; email: string; firstName: string; lastName: string; phone: string | null;
  internalNote: string | null; isActive: boolean; roleId: string; role: Role; roleLabel: string;
  lastLoginAt: string | null; createdAt: string; permissions: Permission[];
};
type RoleRow = { id: string; name: Role; label: string; permissions: Permission[] };
type AuditRow = { id: string; actorId: string | null; action: string; entityId: string | null; createdAt: string };

const groupDefinitions = [
  { label: "Обзор", prefixes: ["dashboard."] },
  { label: "Календарь", prefixes: ["calendar."] },
  { label: "Чаты", prefixes: ["chats."] },
  { label: "Бронирования", prefixes: ["bookings."] },
  { label: "Домики", prefixes: ["houses."] },
  { label: "Услуги", prefixes: ["services."] },
  { label: "Варианты услуг", prefixes: ["service_options."] },
  { label: "Фотографии", prefixes: ["house_images.", "uploads."] },
  { label: "Отзывы", prefixes: ["reviews."] },
  { label: "Пользователи", prefixes: ["users."] },
  { label: "Настройки", prefixes: ["settings."] },
  { label: "Интеграции", prefixes: ["integrations.", "external_calendars.", "calendar_conflicts."] },
  { label: "Клиенты и контент", prefixes: ["customers.", "content.", "reports."] }
];

export function UserAccessManager({ initialUsers, roles, permissions, initialAuditLogs, currentUserId, currentPermissions }: {
  initialUsers: UserRow[];
  roles: RoleRow[];
  permissions: Array<{ key: Permission; description: string }>;
  initialAuditLogs: AuditRow[];
  currentUserId: string;
  currentPermissions: Permission[];
}) {
  const [users, setUsers] = useState(initialUsers);
  const [auditLogs, setAuditLogs] = useState(initialAuditLogs);
  const [editing, setEditing] = useState<UserRow | null | undefined>(undefined);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const canCreate = currentPermissions.includes("users.create");
  const canUpdate = currentPermissions.includes("users.update");
  const canDelete = currentPermissions.includes("users.delete");
  const canReset = currentPermissions.includes("users.reset_password");
  const currentRole = users.find((user) => user.id === currentUserId)?.role;
  const assignableRoles = currentRole === "super_admin" ? roles : roles.filter((role) => role.name !== "super_admin");

  const filtered = useMemo(() => users.filter((user) => {
    const query = search.toLowerCase();
    return (!query || `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(query))
      && (!roleFilter || user.role === roleFilter)
      && (!statusFilter || String(user.isActive) === statusFilter);
  }), [users, search, roleFilter, statusFilter]);

  async function reload(message: string) {
    const response = await fetch("/api/admin/users");
    const body = await response.json();
    if (response.ok) {
      setUsers(body.users);
      setAuditLogs(body.auditLogs);
    }
    setNotice(message);
  }

  async function toggle(user: UserRow) {
    if (!confirm(user.isActive ? "Деактивировать пользователя?" : "Активировать пользователя?")) return;
    setBusyId(user.id);
    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive })
    });
    const body = await response.json().catch(() => ({}));
    setBusyId("");
    if (!response.ok) return setNotice(body.title ?? "Не удалось изменить статус");
    await reload(user.isActive ? "Пользователь деактивирован" : "Пользователь активирован");
  }

  async function remove(user: UserRow) {
    if (!confirm(`Удалить пользователя ${user.email}? Это действие необратимо.`)) return;
    setBusyId(user.id);
    const response = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusyId("");
    if (!response.ok) return setNotice(body.title ?? "Не удалось удалить пользователя");
    await reload("Пользователь удалён");
  }

  async function resetPassword(password?: string) {
    if (!resetUser) return;
    setBusyId(resetUser.id);
    const response = await fetch(`/api/admin/users/${resetUser.id}/reset-password`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(password ? { password } : {})
    });
    const body = await response.json().catch(() => ({}));
    setBusyId("");
    if (!response.ok) return setNotice(body.title ?? "Не удалось сбросить пароль");
    setTemporaryPassword(body.temporaryPassword);
    await reload("Пароль сброшен, старые сессии завершены");
  }

  return <div className="form-stack">
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="admin-list-toolbar"><div className="user-filters"><input aria-label="Поиск пользователей" placeholder="Поиск по имени или email" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Фильтр по роли" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="">Все роли</option>{roles.map((role) => <option value={role.name} key={role.id}>{role.label}</option>)}</select><select aria-label="Фильтр по статусу" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Все статусы</option><option value="true">Активные</option><option value="false">Неактивные</option></select></div>{canCreate && <button className="button button-primary" onClick={() => setEditing(null)}>Добавить пользователя</button>}</div>
    <section className="panel"><table className="data-table"><thead><tr><th>Пользователь</th><th>Роль</th><th>Статус</th><th>Создан</th><th>Последний вход</th><th>Действия</th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id}><td data-label="Пользователь"><strong>{user.firstName} {user.lastName}</strong><br /><small>{user.email}</small></td><td data-label="Роль">{user.roleLabel}</td><td data-label="Статус"><span className={`badge ${user.isActive ? "" : "badge-warn"}`}>{user.isActive ? "Активен" : "Неактивен"}</span></td><td data-label="Создан">{new Date(user.createdAt).toLocaleDateString("ru-RU")}</td><td data-label="Последний вход">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ru-RU") : "Не входил"}</td><td data-label=""><div className="action-row">{canUpdate && <button className="button button-ghost" onClick={() => setEditing(user)}>Редактировать</button>}{canReset && user.id !== currentUserId && <button className="button button-ghost" onClick={() => { setResetUser(user); setTemporaryPassword(""); }}>Сбросить пароль</button>}{canUpdate && user.id !== currentUserId && <button className="button button-ghost" disabled={busyId === user.id} onClick={() => toggle(user)}>{user.isActive ? "Деактивировать" : "Активировать"}</button>}{canDelete && user.id !== currentUserId && <button className="button button-ghost" disabled={busyId === user.id} onClick={() => remove(user)}>Удалить</button>}</div></td></tr>)}</tbody></table>{!filtered.length && <p className="notice">Пользователи не найдены.</p>}</section>
    <section className="panel"><h2>Журнал действий</h2>{auditLogs.length ? <div className="event-log">{auditLogs.slice(0, 30).map((log) => { const actor = users.find((user) => user.id === log.actorId); return <div key={log.id}><span className="badge">{log.action}</span><strong>{actor ? `${actor.firstName} ${actor.lastName}` : "Система"}</strong><small>{new Date(log.createdAt).toLocaleString("ru-RU")}</small></div>; })}</div> : <p className="notice">Действий пока нет.</p>}</section>
    {editing !== undefined && <UserEditorModal user={editing} roles={assignableRoles} permissions={permissions} onClose={() => setEditing(undefined)} onSaved={async (message, password, email) => { setEditing(undefined); if (password) setCreatedCredential({ email, password }); await reload(message); }} />}
    {resetUser && <PasswordResetModal user={resetUser} busy={busyId === resetUser.id} temporaryPassword={temporaryPassword} onReset={resetPassword} onClose={() => { setResetUser(null); setTemporaryPassword(""); }} />}
    {createdCredential && <OneTimePasswordModal email={createdCredential.email} password={createdCredential.password} onClose={() => setCreatedCredential(null)} />}
  </div>;
}

function UserEditorModal({ user, roles, permissions, onClose, onSaved }: {
  user: UserRow | null; roles: RoleRow[]; permissions: Array<{ key: Permission; description: string }>;
  onClose: () => void; onSaved: (message: string, password: string | undefined, email: string) => void;
}) {
  const initialRole = user?.role ?? "manager";
  const [draft, setDraft] = useState({
    firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", email: user?.email ?? "",
    phone: user?.phone ?? "", internalNote: user?.internalNote ?? "", role: initialRole,
    isActive: user?.isActive ?? true, permissions: user?.permissions ?? roles.find((role) => role.name === initialRole)?.permissions ?? [],
    password: ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const groups = groupDefinitions.map((group) => ({ ...group, permissions: permissions.filter((permission) => group.prefixes.some((prefix) => permission.key.startsWith(prefix))) })).filter((group) => group.permissions.length);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const response = await fetch(user ? `/api/admin/users/${user.id}` : "/api/admin/users", {
      method: user ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, password: draft.password || undefined })
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return setError(body.title ?? "Не удалось сохранить пользователя");
    onSaved(user ? "Пользователь обновлён" : "Пользователь создан", body.temporaryPassword, draft.email);
  }

  return <AdminModal title={user ? "Редактирование пользователя" : "Новый пользователь"} onClose={onClose} busy={saving}><form className="form-stack" onSubmit={save}>{error && <div className="notice error">{error}</div>}<div className="form-grid"><div className="field"><label>Имя</label><input autoFocus value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} required /></div><div className="field"><label>Фамилия</label><input value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} /></div></div><div className="form-grid"><div className="field"><label>Email / логин</label><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} required /></div><div className="field"><label>Телефон</label><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></div></div>{!user && <div className="field"><label>Временный пароль</label><input type="text" minLength={10} placeholder="Оставьте пустым для генерации" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} /></div>}<div className="form-grid"><div className="field"><label>Роль</label><select value={draft.role} onChange={(event) => { const role = event.target.value as Role; setDraft({ ...draft, role, permissions: roles.find((item) => item.name === role)?.permissions ?? [] }); }}>{roles.map((role) => <option value={role.name} key={role.id}>{role.label}</option>)}</select></div><label className="field-check"><input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} /> Активен</label></div><div className="field"><label>Внутренний комментарий</label><textarea value={draft.internalNote} onChange={(event) => setDraft({ ...draft, internalNote: event.target.value })} /></div><fieldset className="permission-matrix" disabled={draft.role === "super_admin"}><legend>Доступы</legend>{groups.map((group) => <section key={group.label}><h3>{group.label}</h3><div>{group.permissions.map((permission) => <label key={permission.key}><input type="checkbox" checked={draft.role === "super_admin" || draft.permissions.includes(permission.key)} onChange={(event) => setDraft({ ...draft, permissions: event.target.checked ? [...draft.permissions, permission.key] : draft.permissions.filter((key) => key !== permission.key) })} /><span>{permission.description}</span></label>)}</div></section>)}</fieldset><div className="modal-actions"><button className="button button-primary" disabled={saving}>{saving ? "Сохранение…" : "Сохранить"}</button><button className="button button-ghost" type="button" disabled={saving} onClick={onClose}>Отмена</button></div></form></AdminModal>;
}

function PasswordResetModal({ user, busy, temporaryPassword, onReset, onClose }: {
  user: UserRow; busy: boolean; temporaryPassword: string; onReset: (password?: string) => void; onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  return <AdminModal title="Сброс пароля" onClose={onClose} busy={busy}>{temporaryPassword ? <div className="form-stack"><p>Новый временный пароль для {user.email}. Он показывается только сейчас.</p><div className="copy-field"><input value={temporaryPassword} readOnly /><button className="button button-ghost" onClick={() => navigator.clipboard.writeText(temporaryPassword)}>Копировать</button></div><button className="button button-primary" onClick={onClose}>Готово</button></div> : <div className="form-stack"><p>Старый пароль перестанет работать, все активные сессии пользователя будут завершены.</p><div className="field"><label>Новый пароль</label><input autoFocus type="text" minLength={10} placeholder="Оставьте пустым для генерации" value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="action-row"><button className="button button-primary" disabled={busy} onClick={() => onReset(password || undefined)}>{busy ? "Сброс…" : "Сбросить пароль"}</button><button className="button button-ghost" disabled={busy} onClick={onClose}>Отмена</button></div></div>}</AdminModal>;
}

function OneTimePasswordModal({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return <AdminModal title="Пользователь создан" onClose={onClose}><div className="form-stack"><p>Временный пароль для {email}. После закрытия он больше не будет показан.</p><div className="copy-field"><input value={password} readOnly /><button className="button button-ghost" onClick={() => navigator.clipboard.writeText(password)}>Копировать</button></div><button className="button button-primary" onClick={onClose}>Готово</button></div></AdminModal>;
}
