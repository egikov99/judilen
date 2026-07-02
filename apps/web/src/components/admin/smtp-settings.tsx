"use client";

import { useEffect, useState } from "react";

const empty = {
  host: "", port: 587, username: "", password: "", encryption: "starttls",
  fromEmail: "", fromName: "Усадьба «Юдилен»", replyToEmail: "",
  hasPassword: false, status: "not_configured", lastError: ""
};

export function SmtpSettings() {
  const [form, setForm] = useState(empty);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Array<{ id: string; recipient: string; templateKey: string; errorMessage: string; createdAt: string }>>([]);

  useEffect(() => {
    fetch("/api/admin/smtp-settings", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      if (body.item) setForm((value) => ({ ...value, ...body.item, password: "" }));
      setErrors(body.errors ?? []);
    });
  }, []);

  async function action(path: string, options?: RequestInit) {
    setBusy(true);
    setMessage("");
    const response = await fetch(path, options);
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? body.recipient ? `Тестовое письмо отправлено на ${body.recipient}` : "Операция выполнена." : body.detail ?? body.title ?? "Ошибка");
    return response.ok;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const ok = await action("/api/admin/smtp-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    if (ok) setForm((value) => ({ ...value, password: "", hasPassword: value.hasPassword || Boolean(value.password), status: "saved" }));
  }

  return <section className="panel smtp-settings">
    <div className="settings-heading"><div><h2>Почта / SMTP</h2><p>Настройки исходящих писем клиентам и администраторам.</p></div><span className={`badge ${form.status === "connected" ? "" : "badge-warn"}`}>{form.status === "connected" ? "Подключено" : form.status === "error" ? "Ошибка" : "Не проверено"}</span></div>
    <form className="form-stack" onSubmit={save}>
      <div className="form-grid"><div className="field"><label>SMTP host</label><input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required /></div><div className="field"><label>SMTP port</label><input type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} required /></div></div>
      <div className="form-grid"><div className="field"><label>SMTP username</label><input autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div><div className="field"><label>SMTP password</label><input type="password" autoComplete="new-password" placeholder={form.hasPassword ? "Сохранён — оставьте пустым без изменений" : ""} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div></div>
      <div className="field"><label>Шифрование</label><select value={form.encryption} onChange={(e) => setForm({ ...form, encryption: e.target.value })}><option value="none">none</option><option value="ssl">SSL</option><option value="starttls">TLS / STARTTLS</option></select></div>
      <div className="form-grid"><div className="field"><label>From email</label><input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} required /></div><div className="field"><label>From name</label><input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} required /></div></div>
      <div className="field"><label>Reply-to email</label><input type="email" value={form.replyToEmail} onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })} /></div>
      <div className="action-row"><button className="button button-primary" disabled={busy}>Сохранить</button><button className="button button-ghost" type="button" disabled={busy} onClick={() => action("/api/admin/smtp-settings/test", { method: "POST" })}>Проверить подключение</button><button className="button button-ghost" type="button" disabled={busy} onClick={() => action("/api/admin/smtp-settings/test-email", { method: "POST" })}>Отправить тестовое письмо</button></div>
    </form>
    {form.lastError && <p className="notice error">Последняя ошибка: {form.lastError}</p>}
    {message && <p className="notice" role="status">{message}</p>}
    <div><strong>Последние ошибки отправки</strong>{errors.length ? <div className="event-log">{errors.map((error) => <div key={error.id}><span className="badge badge-warn">{error.templateKey}</span><strong>{error.recipient}</strong><small>{error.errorMessage} · {new Date(error.createdAt).toLocaleString("ru-RU")}</small></div>)}</div> : <p className="notice">Ошибок отправки нет.</p>}</div>
  </section>;
}
