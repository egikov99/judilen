"use client";

import { Camera, Copy, MessageCircle, MessagesSquare, Phone, Send, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  communicationProviderDefinitions,
  communicationProviders,
  type CommunicationProvider
} from "@/lib/communication-types";

type ChannelItem = {
  provider: CommunicationProvider;
  status: "connected" | "disconnected" | "error";
  isEnabled: boolean;
  publicConfig: Record<string, string>;
  secretKeys: string[];
  webhookUrl: string | null;
  lastCheckedAt?: string | null;
  lastMessageAt?: string | null;
  lastError?: string | null;
};

type RecentGroupMessage = {
  id: string;
  body: string;
  senderName: string | null;
  createdAt: string;
};

const providerIcons = {
  telegram: Send,
  telegram_group: Users,
  vk: MessageCircle,
  instagram: Camera,
  whatsapp: Phone,
  viber: MessagesSquare
} satisfies Record<CommunicationProvider, typeof Send>;

function initialDrafts() {
  return Object.fromEntries(communicationProviders.map((provider) => [
    provider,
    { publicConfig: {} as Record<string, string>, secretConfig: {} as Record<string, string> }
  ])) as Record<CommunicationProvider, {
    publicConfig: Record<string, string>;
    secretConfig: Record<string, string>;
  }>;
}

export function CommunicationIntegrationManager({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<ChannelItem[]>([]);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [recentGroupMessages, setRecentGroupMessages] = useState<RecentGroupMessage[]>([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/communication-channels", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { items: ChannelItem[]; recentGroupMessages: RecentGroupMessage[] };
    setItems(data.items);
    setRecentGroupMessages(data.recentGroupMessages);
    setDrafts((current) => {
      const next = { ...current };
      for (const item of data.items) {
        next[item.provider] = {
          ...next[item.provider],
          publicConfig: item.publicConfig
        };
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(load, 0);
    return () => window.clearTimeout(initial);
  }, [load]);

  function setField(provider: CommunicationProvider, kind: "publicConfig" | "secretConfig", key: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        [kind]: { ...current[provider][kind], [key]: value }
      }
    }));
  }

  async function save(provider: CommunicationProvider) {
    setBusy(provider);
    setNotice("");
    const response = await fetch(`/api/admin/communication-channels/${provider}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(drafts[provider])
    });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    setNotice(response.ok ? `${communicationProviderDefinitions[provider].label}: настройки сохранены.` : data.title ?? "Не удалось сохранить настройки.");
    if (response.ok) {
      setDrafts((current) => ({ ...current, [provider]: { ...current[provider], secretConfig: {} } }));
      await load();
    }
  }

  async function test(provider: CommunicationProvider) {
    setBusy(provider);
    setNotice("");
    const response = await fetch(`/api/admin/communication-channels/${provider}/test`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setBusy("");
    setNotice(response.ok ? `Подключение проверено: ${data.account}.` : data.detail ?? data.title ?? "Проверка не пройдена.");
    await load();
  }

  async function disconnect(provider: CommunicationProvider) {
    if (!confirm(`Отключить ${communicationProviderDefinitions[provider].label}?`)) return;
    setBusy(provider);
    const response = await fetch(`/api/admin/communication-channels/${provider}`, { method: "DELETE" });
    setBusy("");
    setNotice(response.ok ? "Канал отключён." : "Не удалось отключить канал.");
    await load();
  }

  return <section className="communication-integrations">
    <div className="section-heading compact-heading">
      <div><span className="eyebrow">Коммуникации</span><h2>Каналы сообщений</h2></div>
    </div>
    {notice && <p className="notice" role="status">{notice}</p>}
    <div className="integration-grid communication-grid">
      {communicationProviders.map((provider) => {
        const definition = communicationProviderDefinitions[provider];
        const item = items.find((candidate) => candidate.provider === provider);
        const Icon = providerIcons[provider];
        const connected = item?.status === "connected" && item.isEnabled;
        return <article className="integration-card communication-card" key={provider}>
          <div className="integration-card-head">
            <span className={`provider-mark channel-${provider}`}><Icon size={21} /></span>
            <div><h2>{definition.label}</h2><span className={`badge ${connected ? "" : "badge-warn"}`}>{provider === "telegram_group" ? (connected ? "Бот добавлен" : "Бот не добавлен") : connected ? "Подключено" : item?.status === "error" ? "Ошибка" : "Не подключено"}</span></div>
          </div>
          <p>{definition.description}</p>
          {item?.lastError && <p className="error-text">{item.lastError}</p>}
          {item?.lastMessageAt && <small>Последнее сообщение: {new Date(item.lastMessageAt).toLocaleString("ru-RU")}</small>}
          {canManage && <details>
            <summary>Настроить</summary>
            <div className="form-stack communication-settings">
              {definition.publicFields.map((field) => <div className="field" key={field.key}>
                <label htmlFor={`${provider}-${field.key}`}>{field.label}</label>
                <input
                  id={`${provider}-${field.key}`}
                  value={drafts[provider].publicConfig[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(event) => setField(provider, "publicConfig", field.key, event.target.value)}
                />
              </div>)}
              {definition.secretFields.map((field) => <div className="field" key={field.key}>
                <label htmlFor={`${provider}-${field.key}`}>{field.label}</label>
                <input
                  id={`${provider}-${field.key}`}
                  type="password"
                  autoComplete="new-password"
                  value={drafts[provider].secretConfig[field.key] ?? ""}
                  placeholder={item?.secretKeys.includes(field.key) ? "Сохранён · оставьте пустым" : field.placeholder}
                  onChange={(event) => setField(provider, "secretConfig", field.key, event.target.value)}
                />
              </div>)}
              {item?.webhookUrl && <div className="field">
                <label>Webhook / Callback URL</label>
                <div className="copy-field"><input value={item.webhookUrl} readOnly /><button className="icon-button" type="button" aria-label="Копировать webhook" onClick={() => navigator.clipboard.writeText(item.webhookUrl!)}><Copy size={18} /></button></div>
                {(provider === "instagram" || provider === "whatsapp") && <small>Verify token: {item.webhookUrl.split("/").at(-1)}</small>}
              </div>}
              {provider === "telegram_group" && <p className="notice">Добавьте бота в группу и отключите Privacy Mode через BotFather, чтобы бот получал все сообщения.</p>}
              <div className="action-row">
                <button className="button button-primary" type="button" disabled={busy === provider} onClick={() => save(provider)}>Сохранить</button>
                <button className="button button-ghost" type="button" disabled={busy === provider || !item?.isEnabled} onClick={() => test(provider)}>Проверить подключение</button>
                <button className="button button-ghost" type="button" disabled={busy === provider || !item?.isEnabled} onClick={() => disconnect(provider)}>Отключить</button>
              </div>
              {provider === "telegram_group" && recentGroupMessages.length > 0 && <div className="recent-channel-messages">
                <strong>Последние сообщения</strong>
                {recentGroupMessages.map((message) => <div key={message.id}><span>{message.senderName ?? "Участник"}</span><p>{message.body}</p><time>{new Date(message.createdAt).toLocaleString("ru-RU")}</time></div>)}
              </div>}
            </div>
          </details>}
        </article>;
      })}
    </div>
  </section>;
}
