"use client";

import { BellRing, Download, KeyRound, RotateCcw, Send, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { notificationEventLabels, notificationEventTypes, type NotificationEventType } from "@/lib/notification-types";

type Preference = {
  pushEnabled: boolean;
  eventTypes: NotificationEventType[];
  reminderHours: number;
};

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type VapidStatus = {
  configured: boolean;
  publicKey: string | null;
  privateKeyPreview: string | null;
  source: "env" | "database" | null;
  automaticallyGenerated: boolean;
  message: string;
};

function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

export function PushSettings() {
  const [preference, setPreference] = useState<Preference>({
    pushEnabled: false,
    eventTypes: [...notificationEventTypes],
    reminderHours: 24
  });
  const [subscribed, setSubscribed] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [vapidStatus, setVapidStatus] = useState<VapidStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    fetch("/api/admin/notifications/preferences", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        setPreference(data.preference);
        setSubscribed(data.subscribed);
        setVapidPublicKey(data.vapidPublicKey);
      });
    fetch("/api/admin/notifications/vapid", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (data.item) {
          setVapidStatus(data.item);
          setVapidPublicKey(data.item.publicKey);
        }
        if (!response.ok) throw new Error(data.title ?? "Не удалось проверить VAPID-ключи");
        return data;
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Не удалось проверить VAPID-ключи"));
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function save(next = preference) {
    const response = await fetch("/api/admin/notifications/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next)
    });
    if (!response.ok) throw new Error("Не удалось сохранить настройки");
    setPreference(next);
  }

  async function enablePush() {
    setBusy(true);
    setMessage("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push не поддерживается этим браузером");
      if (!vapidPublicKey) throw new Error("На сервере не настроены VAPID-ключи");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Разрешение на уведомления не предоставлено");
      const registration = await navigator.serviceWorker.ready;
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(vapidPublicKey)
      });
      const response = await fetch("/api/admin/notifications/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) throw new Error("Не удалось сохранить push-подписку");
      setSubscribed(true);
      setPreference((current) => ({ ...current, pushEnabled: true }));
      setMessage("Push-уведомления включены.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось включить push");
    } finally {
      setBusy(false);
    }
  }

  async function disablePush() {
    setBusy(true);
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    await fetch("/api/admin/notifications/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription?.endpoint })
    });
    await subscription?.unsubscribe();
    setSubscribed(false);
    setPreference((current) => ({ ...current, pushEnabled: false }));
    setMessage("Push-уведомления выключены.");
    setBusy(false);
  }

  async function sendTest() {
    setBusy(true);
    const response = await fetch("/api/admin/notifications/test", { method: "POST" });
    setMessage(response.ok ? "Тестовое уведомление отправлено." : "Не удалось отправить тестовое уведомление.");
    setBusy(false);
  }

  async function regenerateVapidKeys() {
    if (!window.confirm("Перегенерировать VAPID-ключи? Все существующие push-подписки перестанут работать, пользователям потребуется включить push заново.")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/notifications/vapid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail ?? data.title ?? "Не удалось перегенерировать ключи");
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await (await registration.pushManager.getSubscription())?.unsubscribe();
      }
      setVapidStatus(data.item);
      setVapidPublicKey(data.item.publicKey);
      setSubscribed(false);
      setPreference((current) => ({ ...current, pushEnabled: false }));
      setMessage(`VAPID-ключи перегенерированы. Сброшено подписок: ${data.invalidatedSubscriptions ?? 0}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось перегенерировать ключи");
    } finally {
      setBusy(false);
    }
  }

  function toggleEvent(eventType: NotificationEventType) {
    setPreference((current) => ({
      ...current,
      eventTypes: current.eventTypes.includes(eventType)
        ? current.eventTypes.filter((item) => item !== eventType)
        : [...current.eventTypes, eventType]
    }));
  }

  return <div className="settings-grid">
    <section className="panel settings-panel">
      <div className="settings-heading"><Smartphone size={22} /><div><h2>Приложение</h2><p>Установите CRM на главный экран телефона.</p></div></div>
      {installPrompt
        ? <button className="button button-primary" type="button" onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}><Download size={18} /> Установить приложение</button>
        : <p className="notice">Откройте меню браузера и выберите «Добавить на главный экран».</p>}
    </section>

    <section className="panel settings-panel">
      <div className="settings-heading"><BellRing size={22} /><div><h2>Push-уведомления</h2><p>Подробности всегда открываются только после авторизации.</p></div></div>
      <div className="action-row">
        {subscribed
          ? <button className="button button-ghost" type="button" disabled={busy} onClick={disablePush}>Выключить push</button>
          : <button className="button button-primary" type="button" disabled={busy} onClick={enablePush}>Включить push</button>}
        <button className="button button-ghost" type="button" disabled={busy || !subscribed} onClick={sendTest}><Send size={17} /> Тест</button>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
    </section>

    <section className="panel settings-panel settings-events vapid-settings">
      <div className="settings-heading"><KeyRound size={22} /><div><h2>VAPID-ключи</h2><p>Серверная подпись для безопасной доставки push-уведомлений.</p></div><span className={`badge ${vapidStatus?.configured ? "" : "badge-warn"}`}>{vapidStatus?.configured ? "Настроено" : vapidStatus ? "Не настроено" : "Проверка…"}</span></div>
      {vapidStatus && <>
        <p className="notice">{vapidStatus.message}</p>
        {vapidStatus.publicKey && <div className="vapid-key-row"><span>Public key</span><code>{vapidStatus.publicKey}</code></div>}
        {vapidStatus.privateKeyPreview && <div className="vapid-key-row"><span>Private key</span><code>{vapidStatus.privateKeyPreview}</code></div>}
        <p className="admin-help">Источник: {vapidStatus.source === "env" ? "переменные окружения" : vapidStatus.source === "database" ? "защищённая конфигурация в БД" : "недоступен"}. Приватный ключ полностью не отображается.</p>
        <button className="button button-ghost" type="button" disabled={busy || vapidStatus.source === "env"} onClick={regenerateVapidKeys}><RotateCcw size={17} /> Перегенерировать ключи</button>
        {vapidStatus.source === "env" && <p className="admin-help">Для ротации ключей измените VAPID_PUBLIC_KEY и VAPID_PRIVATE_KEY в окружении и перезапустите сервер.</p>}
      </>}
    </section>

    <section className="panel settings-panel settings-events">
      <h2>События</h2>
      {notificationEventTypes.map((eventType) => <label key={eventType}>
        <input type="checkbox" checked={preference.eventTypes.includes(eventType)} onChange={() => toggleEvent(eventType)} />
        <span>{notificationEventLabels[eventType]}</span>
      </label>)}
      <div className="field">
        <label htmlFor="reminderHours">Напоминать о заселении за</label>
        <select id="reminderHours" value={preference.reminderHours} onChange={(event) => setPreference((current) => ({ ...current, reminderHours: Number(event.target.value) }))}>
          <option value="6">6 часов</option>
          <option value="12">12 часов</option>
          <option value="24">24 часа</option>
          <option value="48">48 часов</option>
        </select>
      </div>
      <button className="button button-primary" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await save(); setMessage("Настройки сохранены."); } catch (error) { setMessage(error instanceof Error ? error.message : "Ошибка сохранения"); } finally { setBusy(false); } }}>Сохранить настройки</button>
    </section>
  </div>;
}
