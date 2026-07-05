"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

type Provider = "ical" | "booking" | "airbnb" | "ostrovok" | "expedia" | "google_travel" | "tripadvisor" | "other";
type House = { id: string; name: string };
type Integration = {
  id: string;
  kind: Provider;
  name: string;
  isEnabled: boolean;
  lastSyncedAt: string | null;
  importedCount: number;
  errorCount: number;
};
type Calendar = {
  id: string;
  integrationId: string | null;
  houseId: string;
  houseName: string;
  provider: Provider;
  name: string;
  importUrl: string | null;
  exportUrl: string;
  isActive: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};
type Log = { id: string; integrationId: string; level: string; message: string; context: Record<string, unknown> | null; createdAt: string };
type Conflict = { id: string; houseName: string; calendarName: string; source: string; externalUid: string; startDate: string; endDate: string; summary: string; status: string };

const providers: Array<{ id: Provider; name: string; description: string }> = [
  { id: "booking", name: "Booking.com", description: "Обмен занятостью через iCal." },
  { id: "airbnb", name: "Airbnb", description: "Импорт и экспорт календаря объекта." },
  { id: "ostrovok", name: "Ostrovok", description: "Синхронизация занятых дат." },
  { id: "expedia", name: "Expedia", description: "Календарный канал Expedia." },
  { id: "google_travel", name: "Google Travel", description: "Архитектура готова к подключению." },
  { id: "tripadvisor", name: "TripAdvisor", description: "Календарный канал TripAdvisor." },
  { id: "ical", name: "iCal / другая платформа", description: "Любой HTTPS-адрес календаря .ics." }
];

const emptyForm = (houseId: string, provider: Provider = "ical") => ({
  id: "",
  provider,
  name: providers.find((item) => item.id === provider)?.name ?? "",
  houseId,
  importUrl: "",
  isActive: true,
  syncIntervalMinutes: 60
});

export function IntegrationManager({ canManage, houses, integrations, calendars, logs, conflicts }: {
  canManage: boolean;
  houses: House[];
  integrations: Integration[];
  calendars: Calendar[];
  logs: Log[];
  conflicts: Conflict[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(emptyForm(houses[0]?.id ?? ""));
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  const integrationsByProvider = useMemo(() => new Map(integrations.map((item) => [item.kind, item])), [integrations]);

  function configure(provider: Provider) {
    setEditing(emptyForm(houses[0]?.id ?? "", provider));
    document.getElementById("calendar-settings")?.scrollIntoView({ behavior: "smooth" });
  }

  function edit(calendar: Calendar) {
    setEditing({
      id: calendar.id,
      provider: calendar.provider,
      name: calendar.name,
      houseId: calendar.houseId,
      importUrl: calendar.importUrl ?? "",
      isActive: calendar.isActive,
      syncIntervalMinutes: calendar.syncIntervalMinutes
    });
    document.getElementById("calendar-settings")?.scrollIntoView({ behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch(editing.id ? `/api/admin/external-calendars/${editing.id}` : "/api/admin/external-calendars", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(body.title ?? "Не удалось сохранить подключение");
    setMessage("Подключение сохранено");
    setEditing(emptyForm(houses[0]?.id ?? ""));
    router.refresh();
  }

  async function sync(id: string) {
    setBusyId(id);
    setMessage("");
    const response = await fetch(`/api/admin/external-calendars/${id}/sync`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusyId("");
    setMessage(response.ok
      ? `Синхронизация завершена: новых ${body.imported}, обновлено ${body.updated}, конфликтов ${body.conflicts}`
      : body.title ?? "Ошибка синхронизации");
    router.refresh();
  }

  async function toggle(calendar: Calendar) {
    await fetch(`/api/admin/external-calendars/${calendar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !calendar.isActive })
    });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Удалить подключение и его внешние ссылки?")) return;
    await fetch(`/api/admin/external-calendars/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function resolve(id: string, action: "keep_crm" | "accept_external") {
    setBusyId(id);
    const response = await fetch(`/api/admin/calendar-conflicts/${id}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: action === "keep_crm" ? "Сохранена занятость CRM" : "Принято внешнее бронирование" })
    });
    const body = await response.json().catch(() => ({}));
    setBusyId("");
    setMessage(response.ok ? "Конфликт разрешён" : body.title ?? "Не удалось разрешить конфликт");
    router.refresh();
  }

  return <div className="form-stack">
    {message && <div className="notice">{message}</div>}
    <div className="integration-grid">
      {providers.map((provider) => {
        const integration = integrationsByProvider.get(provider.id);
        const providerCalendars = calendars.filter((item) => item.provider === provider.id);
        const connected = providerCalendars.some((item) => item.isActive);
        return <article className="integration-card" key={provider.id}>
          <div className="integration-card-head"><span className="provider-mark">{provider.name.slice(0, 1)}</span><div><h2>{provider.name}</h2><span className={`badge ${connected ? "" : "badge-warn"}`}>{connected ? "Подключено" : "Не подключено"}</span></div></div>
          <p>{provider.description}</p>
          <dl className="integration-stats">
            <div><dt>Календарей</dt><dd>{providerCalendars.length}</dd></div>
            <div><dt>Импортировано</dt><dd>{integration?.importedCount ?? 0}</dd></div>
            <div><dt>Ошибок</dt><dd>{integration?.errorCount ?? 0}</dd></div>
          </dl>
          <small>Последняя синхронизация: {integration?.lastSyncedAt ? new Date(integration.lastSyncedAt).toLocaleString("ru-RU") : "не запускалась"}</small>
          {canManage && <button className="button button-ghost" type="button" onClick={() => configure(provider.id)}>Настроить</button>}
        </article>;
      })}
    </div>

    {canManage && <section className="panel" id="calendar-settings">
      <h2>{editing.id ? "Настройка календаря" : "Новое iCal-подключение"}</h2>
      <form className="form-stack" onSubmit={save}>
        <div className="form-grid">
          <div className="field"><label>Платформа</label><select value={editing.provider} onChange={(event) => setEditing({ ...editing, provider: event.target.value as Provider })}>{providers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="field"><label>Название подключения</label><input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required /></div>
        </div>
        <div className="form-grid">
          <div className="field"><label>Домик</label><select value={editing.houseId} onChange={(event) => setEditing({ ...editing, houseId: event.target.value })} required>{houses.map((house) => <option key={house.id} value={house.id}>{house.name}</option>)}</select></div>
          <div className="field"><label>Интервал синхронизации</label><select value={editing.syncIntervalMinutes} onChange={(event) => setEditing({ ...editing, syncIntervalMinutes: Number(event.target.value) })}><option value={15}>15 минут</option><option value={30}>30 минут</option><option value={60}>1 час</option><option value={360}>6 часов</option><option value={1440}>24 часа</option></select></div>
        </div>
        <div className="field"><label>Import iCal URL</label><input type="url" pattern="https://.*" value={editing.importUrl} onChange={(event) => setEditing({ ...editing, importUrl: event.target.value })} required /></div>
        <label><input type="checkbox" checked={editing.isActive} onChange={(event) => setEditing({ ...editing, isActive: event.target.checked })} /> Активно</label>
        <div className="action-row"><button className="button button-primary">Сохранить</button>{editing.id && <button className="button button-ghost" type="button" disabled={busyId === editing.id} onClick={() => sync(editing.id)}>Проверить ссылку</button>}</div>
      </form>
    </section>}

    <section className="panel">
      <h2>Календари домиков</h2>
      {calendars.length ? <div className="calendar-connections">{calendars.map((calendar) => <article className="calendar-connection" key={calendar.id}>
        <div><strong>{calendar.name}</strong><div><span className="badge">{calendar.provider}</span> <span className={`badge ${calendar.isActive ? "" : "badge-warn"}`}>{calendar.isActive ? "Активен" : "Отключён"}</span></div></div>
        <p>{calendar.houseName}<br /><small>Последний успех: {calendar.lastSuccessAt ? new Date(calendar.lastSuccessAt).toLocaleString("ru-RU") : "ещё не было"}</small>{calendar.lastError && <><br /><span className="error-text">{calendar.lastError}</span></>}</p>
        {canManage && <><div className="field"><label>Export iCal URL CRM</label><div className="copy-field"><input value={calendar.exportUrl} readOnly /><button className="button button-ghost" type="button" onClick={() => navigator.clipboard.writeText(calendar.exportUrl)}>Копировать</button></div></div>
        <div className="action-row"><button className="button button-primary" type="button" disabled={busyId === calendar.id || !calendar.isActive} onClick={() => sync(calendar.id)}>Синхронизировать сейчас</button><button className="button button-ghost" type="button" onClick={() => edit(calendar)}>Настроить</button><button className="button button-ghost" type="button" onClick={() => toggle(calendar)}>{calendar.isActive ? "Отключить" : "Включить"}</button><button className="button button-ghost" type="button" onClick={() => remove(calendar.id)}>Удалить</button></div></>}
      </article>)}</div> : <p className="notice">Внешние календари ещё не подключены.</p>}
    </section>

    <section className="panel">
      <h2>Конфликты</h2>
      {conflicts.filter((item) => item.status === "open").length ? <div className="form-stack">{conflicts.filter((item) => item.status === "open").map((conflict) => <article className="conflict-row" key={conflict.id}>
        <div><strong>{conflict.houseName}: {conflict.summary}</strong><p>{conflict.startDate} - {conflict.endDate} · {conflict.source} · UID {conflict.externalUid}</p></div>
        {canManage && <div className="action-row"><button className="button button-ghost" disabled={busyId === conflict.id} onClick={() => resolve(conflict.id, "keep_crm")}>Оставить CRM</button><button className="button button-secondary" disabled={busyId === conflict.id} onClick={() => resolve(conflict.id, "accept_external")}>Принять внешнее</button></div>}
      </article>)}</div> : <p className="notice">Открытых конфликтов нет.</p>}
    </section>

    <section className="panel">
      <h2>Последние события</h2>
      {logs.length ? <div className="event-log">{logs.map((log) => <div key={log.id}><span className={`badge ${log.level === "error" ? "badge-warn" : ""}`}>{log.level}</span><strong>{log.message}</strong><small>{new Date(log.createdAt).toLocaleString("ru-RU")}{log.context ? ` · ${JSON.stringify(log.context)}` : ""}</small></div>)}</div> : <p className="notice">Событий синхронизации пока нет.</p>}
    </section>
  </div>;
}
