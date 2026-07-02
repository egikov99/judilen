"use client";

import { Copy, KeyRound, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type VkSettings = {
  groupId: string;
  groupName: string | null;
  apiVersion: string;
  callbackUrl: string;
  status: "not_configured" | "pending" | "connected" | "error";
  hasAccessToken: boolean;
  hasSecretKey: boolean;
  hasConfirmationToken: boolean;
  lastConfirmedAt: string | null;
  lastEventAt: string | null;
};

const statusLabels = {
  not_configured: "Не настроено",
  pending: "Ожидает подтверждения",
  connected: "Подключено",
  error: "Ошибка"
};

export function VkIntegrationSettings({ canManage }: { canManage: boolean }) {
  const [item, setItem] = useState<VkSettings | null>(null);
  const [draft, setDraft] = useState({
    groupId: "",
    apiVersion: "5.199",
    accessToken: "",
    secretKey: "",
    confirmationToken: ""
  });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/vk-integration", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { item: VkSettings };
    setItem(data.item);
    setDraft((current) => ({
      ...current,
      groupId: data.item.groupId,
      apiVersion: data.item.apiVersion
    }));
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  function setField(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function generate() {
    setBusy("generate");
    const response = await fetch("/api/admin/vk-integration/generate", { method: "POST" });
    const data = await response.json().catch(() => ({})) as { secretKey?: string; title?: string };
    setBusy("");
    if (!response.ok || !data.secretKey) {
      setNotice(data.title ?? "Не удалось сгенерировать ключ.");
      return;
    }
    setField("secretKey", data.secretKey);
    setNotice("Секретный ключ сгенерирован. Скопируйте его в настройки Callback API VK.");
  }

  async function save() {
    setBusy("save");
    setNotice("");
    const response = await fetch("/api/admin/vk-integration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft)
    });
    const data = await response.json().catch(() => ({})) as { title?: string; detail?: string };
    setBusy("");
    setNotice(response.ok
      ? "Настройки сохранены. Подтвердите адрес сервера в VK."
      : data.detail ?? data.title ?? "Не удалось сохранить настройки.");
    if (response.ok) {
      setDraft((current) => ({ ...current, accessToken: "", secretKey: "", confirmationToken: "" }));
      await load();
    }
  }

  async function test() {
    setBusy("test");
    setNotice("");
    const response = await fetch("/api/admin/vk-integration/test", { method: "POST" });
    const data = await response.json().catch(() => ({})) as { account?: string; title?: string; detail?: string };
    setBusy("");
    setNotice(response.ok
      ? `Токен сообщества работает: ${data.account}.`
      : data.detail ?? data.title ?? "Проверка не пройдена.");
    await load();
  }

  async function disconnect() {
    if (!confirm("Отключить VK?")) return;
    setBusy("disconnect");
    const response = await fetch("/api/admin/vk-integration", { method: "DELETE" });
    setBusy("");
    setNotice(response.ok ? "VK отключён." : "Не удалось отключить VK.");
    await load();
  }

  const status = item?.status ?? "not_configured";
  return <article className="integration-card communication-card">
    <div className="integration-card-head">
      <span className="provider-mark channel-vk"><MessageCircle size={21} /></span>
      <div>
        <h2>VK</h2>
        <span className={`badge ${status === "connected" ? "" : "badge-warn"}`}>
          {statusLabels[status]}
        </span>
      </div>
    </div>
    <p>Сообщения сообщества через Callback API.</p>
    {item?.groupName && <small>Сообщество: {item.groupName}</small>}
    {item?.lastEventAt && <small>Последнее событие: {new Date(item.lastEventAt).toLocaleString("ru-RU")}</small>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {canManage && <details>
      <summary>Настроить</summary>
      <div className="form-stack communication-settings">
        <div className="field">
          <label htmlFor="vk-callback-url">Адрес сервера</label>
          <div className="copy-field">
            <input id="vk-callback-url" value={item?.callbackUrl ?? ""} readOnly />
            <button
              className="icon-button"
              type="button"
              aria-label="Скопировать адрес сервера"
              title="Скопировать адрес сервера"
              disabled={!item?.callbackUrl}
              onClick={() => navigator.clipboard.writeText(item?.callbackUrl ?? "")}
            ><Copy size={18} /></button>
          </div>
          <small>Укажите этот публичный HTTPS-адрес в настройках Callback API сообщества.</small>
        </div>
        <div className="field">
          <label htmlFor="vk-group-id">ID сообщества</label>
          <input
            id="vk-group-id"
            inputMode="numeric"
            value={draft.groupId}
            onChange={(event) => setField("groupId", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vk-api-version">Версия API</label>
          <input
            id="vk-api-version"
            value={draft.apiVersion}
            onChange={(event) => setField("apiVersion", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vk-access-token">Токен сообщества</label>
          <input
            id="vk-access-token"
            type="password"
            autoComplete="new-password"
            value={draft.accessToken}
            placeholder={item?.hasAccessToken ? "Сохранён · оставьте пустым" : ""}
            onChange={(event) => setField("accessToken", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="vk-secret-key">Секретный ключ</label>
          <div className="copy-field">
            <input
              id="vk-secret-key"
              type="text"
              autoComplete="off"
              value={draft.secretKey}
              placeholder={item?.hasSecretKey ? "Сохранён · оставьте пустым" : ""}
              onChange={(event) => setField("secretKey", event.target.value)}
            />
            <button
              className="icon-button"
              type="button"
              aria-label="Скопировать секретный ключ"
              title="Скопировать секретный ключ"
              disabled={!draft.secretKey}
              onClick={() => navigator.clipboard.writeText(draft.secretKey)}
            ><Copy size={18} /></button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="vk-confirmation-token">Confirmation token</label>
          <input
            id="vk-confirmation-token"
            value={draft.confirmationToken}
            placeholder={item?.hasConfirmationToken ? "Сохранён · оставьте пустым" : "Строка, которую показывает VK"}
            onChange={(event) => setField("confirmationToken", event.target.value)}
          />
          <small>Скопируйте сюда строку из блока подтверждения адреса в VK. Её генерирует VK, а не CRM.</small>
        </div>
        <div className="action-row">
          <button className="button button-ghost" type="button" disabled={Boolean(busy)} onClick={generate}>
            <KeyRound size={17} /> Сгенерировать ключи
          </button>
          <button className="button button-primary" type="button" disabled={Boolean(busy)} onClick={save}>
            {busy === "save" ? "Сохранение..." : "Сохранить"}
          </button>
          <button className="button button-ghost" type="button" disabled={Boolean(busy) || status === "not_configured"} onClick={test}>
            Тест подключения
          </button>
          <button className="button button-ghost" type="button" disabled={Boolean(busy) || status === "not_configured"} onClick={disconnect}>
            Отключить
          </button>
        </div>
      </div>
    </details>}
  </article>;
}
