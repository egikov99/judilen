"use client";

import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { useEffect, useState } from "react";

type DiagnosticCheck = { stage: string; status: "passed" | "skipped"; message: string };
type DiagnosticResult = {
  success: boolean;
  title?: string;
  message: string;
  code?: string;
  stage?: string;
  description?: string;
  details?: string;
  recommendations?: string[];
  checks?: DiagnosticCheck[];
  recipient?: string;
  settingsSaved?: boolean;
  hasPassword?: boolean;
};

const stageLabels: Record<string, string> = {
  configuration: "Настройки",
  dns: "DNS",
  connection: "Соединение и порт",
  tls: "SSL / TLS",
  authentication: "Авторизация",
  send: "Отправка письма"
};

const empty = {
  host: "", port: 587, username: "", password: "", encryption: "starttls",
  fromEmail: "", fromName: "Усадьба «Юдилен»", replyToEmail: "", testRecipient: "",
  hasPassword: false, status: "not_configured", lastError: ""
};

function normalizeResponse(response: Response, body: Record<string, unknown>): DiagnosticResult {
  if (response.ok) {
    return {
      success: true,
      title: String(body.title ?? "Подключение успешно"),
      message: String(body.message ?? "SMTP готов к отправке писем."),
      checks: Array.isArray(body.checks) ? body.checks as DiagnosticCheck[] : [],
      recipient: typeof body.recipient === "string" ? body.recipient : undefined,
      hasPassword: typeof body.hasPassword === "boolean" ? body.hasPassword : undefined,
      settingsSaved: body.settingsSaved === true
    };
  }
  return {
    success: false,
    title: String(body.title ?? "Ошибка подключения"),
    message: String(body.message ?? body.detail ?? "Не удалось выполнить SMTP-проверку."),
    code: String(body.code ?? `HTTP_${response.status}`),
    stage: typeof body.stage === "string" ? body.stage : undefined,
    description: String(body.description ?? body.detail ?? "SMTP-проверка завершилась ошибкой."),
    details: String(body.details ?? body.detail ?? body.message ?? "Технические детали отсутствуют."),
    recommendations: Array.isArray(body.recommendations) ? body.recommendations.map(String) : ["Проверьте SMTP host, порт, шифрование и учётные данные."],
    hasPassword: typeof body.hasPassword === "boolean" ? body.hasPassword : undefined,
    settingsSaved: body.settingsSaved === true
  };
}

export function SmtpSettings() {
  const [form, setForm] = useState(empty);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "verify" | "send" | null>(null);
  const [copied, setCopied] = useState(false);
  const [errors, setErrors] = useState<Array<{ id: string; recipient: string; templateKey: string; errorMessage: string; createdAt: string }>>([]);

  useEffect(() => {
    fetch("/api/admin/smtp-settings", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json();
      if (body.item) setForm((value) => ({ ...value, ...body.item, password: "", testRecipient: "" }));
      setErrors(body.errors ?? []);
    });
  }, []);

  async function action(path: string, kind: "save" | "verify" | "send", options?: RequestInit) {
    setBusyAction(kind);
    setDiagnostic(null);
    setCopied(false);
    try {
      const response = await fetch(path, options);
      const body = await response.json().catch(() => ({}));
      const result = normalizeResponse(response, body);
      setDiagnostic(result);
      setForm((value) => ({
        ...value,
        status: result.success ? "connected" : "error",
        ...(result.hasPassword === undefined ? {} : { hasPassword: result.hasPassword })
      }));
      return result;
    } catch (error) {
      const result: DiagnosticResult = {
        success: false,
        title: "Сетевая ошибка",
        code: "FETCH_ERROR",
        message: error instanceof Error ? error.message : "Запрос диагностики не выполнен.",
        description: "Браузер не получил ответ от сервера.",
        details: error instanceof Error ? error.message : String(error),
        recommendations: ["Проверьте соединение с сайтом.", "Повторите попытку и проверьте серверные логи."]
      };
      setDiagnostic(result);
      return result;
    } finally {
      setBusyAction(null);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const result = await action("/api/admin/smtp-settings", "save", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
    });
    if (result.settingsSaved) {
      setForm((value) => ({ ...value, password: "", hasPassword: result.hasPassword ?? value.hasPassword }));
    }
  }

  const recipientBody = JSON.stringify({ recipient: form.testRecipient.trim() || undefined });
  const busy = busyAction !== null;

  return <section className="panel smtp-settings">
    <div className="settings-heading"><div><h2>Почта / SMTP</h2><p>Настройки исходящих писем клиентам и администраторам.</p></div><span className={`badge ${form.status === "connected" ? "" : "badge-warn"}`}>{form.status === "connected" ? "Подключено" : form.status === "error" ? "Ошибка" : "Не проверено"}</span></div>
    <form className="form-stack" onSubmit={save}>
      <div className="form-grid"><div className="field"><label>SMTP host</label><input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} required /></div><div className="field"><label>SMTP port</label><input type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} required /></div></div>
      <div className="form-grid"><div className="field"><label>SMTP username</label><input autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div><div className="field"><label>SMTP password</label><input type="password" autoComplete="new-password" placeholder={form.hasPassword ? "Сохранён — оставьте пустым без изменений" : ""} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div></div>
      <div className="field"><label>Шифрование</label><select value={form.encryption} onChange={(e) => setForm({ ...form, encryption: e.target.value })}><option value="none">none</option><option value="ssl">SSL</option><option value="starttls">TLS / STARTTLS</option></select></div>
      <div className="form-grid"><div className="field"><label>From email</label><input type="email" value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} required /></div><div className="field"><label>From name</label><input value={form.fromName} onChange={(e) => setForm({ ...form, fromName: e.target.value })} required /></div></div>
      <div className="field"><label>Reply-to email</label><input type="email" value={form.replyToEmail} onChange={(e) => setForm({ ...form, replyToEmail: e.target.value })} /></div>
      <div className="field"><label>Адрес для тестового письма</label><input type="email" placeholder="Оставьте пустым для проверки без отправки" value={form.testRecipient} onChange={(e) => setForm({ ...form, testRecipient: e.target.value })} /><small>Если адрес указан, проверка или сохранение также отправит тестовое письмо.</small></div>
      <div className="action-row">
        <button className="button button-primary" disabled={busy}>{busyAction === "save" ? "Сохраняем и проверяем…" : "Сохранить"}</button>
        <button className="button button-ghost" type="button" disabled={busy} onClick={() => action("/api/admin/smtp-settings/test", "verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: recipientBody })}>{busyAction === "verify" ? "Проверяем…" : "Проверить подключение"}</button>
        <button className="button button-ghost" type="button" disabled={busy} onClick={() => action("/api/admin/smtp-settings/test-email", "send", { method: "POST", headers: { "Content-Type": "application/json" }, body: recipientBody })}>{busyAction === "send" ? "Отправляем…" : "Отправить тестовое письмо"}</button>
      </div>
    </form>

    {diagnostic && <SmtpDiagnosticPanel diagnostic={diagnostic} copied={copied} onCopy={async () => {
      const text = [
        diagnostic.title, `Код: ${diagnostic.code ?? "OK"}`, diagnostic.message,
        diagnostic.description, diagnostic.details,
        ...(diagnostic.recommendations ?? []).map((item) => `• ${item}`)
      ].filter(Boolean).join("\n\n");
      await navigator.clipboard.writeText(text);
      setCopied(true);
    }} />}

    {form.lastError && !diagnostic && <p className="notice error">Последняя ошибка: {form.lastError}</p>}
    <div><strong>Последние ошибки отправки</strong>{errors.length ? <div className="event-log">{errors.map((error) => <div key={error.id}><span className="badge badge-warn">{error.templateKey}</span><strong>{error.recipient}</strong><small>{error.errorMessage} · {new Date(error.createdAt).toLocaleString("ru-RU")}</small></div>)}</div> : <p className="notice">Ошибок отправки нет.</p>}</div>
  </section>;
}

function SmtpDiagnosticPanel({ diagnostic, copied, onCopy }: {
  diagnostic: DiagnosticResult;
  copied: boolean;
  onCopy: () => Promise<void>;
}) {
  return <section className={`smtp-diagnostic ${diagnostic.success ? "is-success" : "is-error"}`} role={diagnostic.success ? "status" : "alert"}>
    <div className="smtp-diagnostic-icon">{diagnostic.success ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}</div>
    <div className="smtp-diagnostic-content">
      <h3>{diagnostic.title ?? (diagnostic.success ? "Подключение успешно" : "Ошибка подключения")}</h3>
      <p>{diagnostic.message}</p>
      {diagnostic.success ? <ul className="smtp-check-list">{diagnostic.checks?.map((check, index) => <li key={`${check.stage}-${index}`}><CheckCircle2 size={17} /><span>{check.message}</span></li>)}</ul> : <>
        <dl className="smtp-error-summary">
          <div><dt>Код</dt><dd>{diagnostic.code}</dd></div>
          {diagnostic.stage && <div><dt>Этап</dt><dd>{stageLabels[diagnostic.stage] ?? diagnostic.stage}</dd></div>}
          <div><dt>Описание</dt><dd>{diagnostic.description}</dd></div>
        </dl>
        {!!diagnostic.recommendations?.length && <div className="smtp-recommendations"><strong>Рекомендации</strong><ul>{diagnostic.recommendations.map((item) => <li key={item}>{item}</li>)}</ul></div>}
        <details className="smtp-technical-details"><summary>Технические детали</summary><pre>{diagnostic.details}</pre></details>
        <button className="button button-ghost smtp-copy-error" type="button" onClick={() => void onCopy()}><Copy size={17} />{copied ? "Скопировано" : "Скопировать ошибку"}</button>
      </>}
    </div>
  </section>;
}
