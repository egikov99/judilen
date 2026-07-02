"use client";

import { useState } from "react";
import { EMAIL_TEMPLATE_VARIABLES, type EmailTemplateKey } from "@/lib/email-templates";

type Template = {
  key: EmailTemplateKey;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
};

export function EmailTemplateEditor({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [activeKey, setActiveKey] = useState<EmailTemplateKey>(initialTemplates[0].key);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const current = templates.find((item) => item.key === activeKey)!;

  function update(change: Partial<Template>) {
    setTemplates((items) => items.map((item) => item.key === activeKey ? { ...item, ...change } : item));
    setMessage("");
  }

  async function request(method: "PATCH" | "DELETE" | "POST", suffix = "", body?: object) {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/email-templates/${activeKey}${suffix}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) return setMessage(payload.detail ?? payload.title ?? "Ошибка");
    if (payload.item) update(payload.item);
    setMessage(method === "PATCH" ? "Шаблон сохранён." : method === "DELETE" ? "Стандартный шаблон восстановлен." : `Тестовое письмо отправлено на ${payload.recipient}.`);
  }

  return <div className="email-template-layout">
    <nav className="panel email-template-list" aria-label="Email-шаблоны">{templates.map((item) =>
      <button className={item.key === activeKey ? "is-active" : ""} type="button" key={item.key} onClick={() => { setActiveKey(item.key); setMessage(""); }}>{item.name}</button>
    )}</nav>
    <section className="panel email-template-form">
      <h2>{current.name}</h2>
      <div className="field"><label>Тема письма</label><input value={current.subject} onChange={(event) => update({ subject: event.target.value })} /></div>
      <div className="field"><label>HTML-содержимое</label><textarea className="code-editor" value={current.htmlContent} onChange={(event) => update({ htmlContent: event.target.value })} /></div>
      <div className="field"><label>Текстовая версия</label><textarea value={current.textContent} onChange={(event) => update({ textContent: event.target.value })} /></div>
      <div><strong>Доступные переменные</strong><div className="template-variables">{EMAIL_TEMPLATE_VARIABLES.map((variable) => <code key={variable}>{`{{${variable}}}`}</code>)}</div></div>
      <div><strong>Предпросмотр</strong><iframe className="email-preview-frame" sandbox="" title="Предпросмотр письма" srcDoc={current.htmlContent} /></div>
      <div className="action-row">
        <button className="button button-primary" disabled={busy} onClick={() => request("PATCH", "", current)}>Сохранить</button>
        <button className="button button-ghost" disabled={busy} onClick={() => request("POST", "/test")}>Отправить тестовое письмо</button>
        <button className="button button-ghost" disabled={busy} onClick={() => request("DELETE")}>Сбросить к стандартному</button>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
    </section>
  </div>;
}
