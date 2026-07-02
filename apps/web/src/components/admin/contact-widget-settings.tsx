"use client";

import { useEffect, useState } from "react";
import type { ContactWidgetChannelType } from "@/lib/contact-widget";

type Channel = {
  channelType: ContactWidgetChannelType;
  enabled: boolean;
  displayName: string;
  subtitle: string;
  url: string;
  phone: string;
  username: string;
  defaultMessage: string;
  sortOrder: number;
  icon: string;
  status: "configured" | "invalid" | "disabled";
};

const channelLabels: Record<ContactWidgetChannelType, string> = {
  telegram: "Telegram", viber: "Viber", whatsapp: "WhatsApp",
  instagram: "Instagram", website: "Чат на сайте"
};

export function ContactWidgetSettings() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/contact-widget-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить настройки");
        return response.json();
      })
      .then((body) => setChannels(body.channels))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Ошибка загрузки"));
  }, []);

  function update(type: ContactWidgetChannelType, change: Partial<Channel>) {
    setChannels((items) => items.map((item) => item.channelType === type ? { ...item, ...change } : item));
    setMessage("");
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/contact-widget-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channels })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(response.ok ? "Настройки виджета сохранены." : body.detail ?? body.title ?? "Не удалось сохранить настройки");
    if (response.ok) {
      setChannels((items) => items.map((item) => ({
        ...item,
        status: item.enabled ? "configured" : "disabled"
      })));
    }
  }

  return <div className="form-stack">
    {channels.map((channel) => <section className="panel contact-channel-settings" key={channel.channelType}>
      <div className="settings-heading">
        <div><h2>{channelLabels[channel.channelType]}</h2><p>Настройки отображения в публичном виджете.</p></div>
        <span className={`badge ${channel.status === "configured" ? "" : "badge-warn"}`}>{channel.status === "configured" ? "Настроен" : channel.status === "invalid" ? "Заполните настройки" : "Отключён"}</span>
      </div>
      <label className="field-check"><input type="checkbox" checked={channel.enabled} onChange={(event) => update(channel.channelType, { enabled: event.target.checked })} /> Показывать канал в виджете</label>
      <div className="form-grid">
        <div className="field"><label>{channel.channelType === "website" ? "Заголовок чата" : "Название канала"}</label><input value={channel.displayName} onChange={(event) => update(channel.channelType, { displayName: event.target.value })} /></div>
        <div className="field"><label>Подпись для клиента</label><input value={channel.subtitle} onChange={(event) => update(channel.channelType, { subtitle: event.target.value })} /></div>
      </div>
      {(channel.channelType === "telegram" || channel.channelType === "instagram") && <div className="form-grid">
        <div className="field"><label>Username</label><input placeholder="@username" value={channel.username} onChange={(event) => update(channel.channelType, { username: event.target.value })} /></div>
        <div className="field"><label>Прямая ссылка</label><input type="url" placeholder={channel.channelType === "telegram" ? "https://t.me/username" : "https://instagram.com/username"} value={channel.url} onChange={(event) => update(channel.channelType, { url: event.target.value })} /></div>
      </div>}
      {(channel.channelType === "viber" || channel.channelType === "whatsapp") && <div className="form-grid">
        <div className="field"><label>Номер телефона</label><input type="tel" placeholder="+375XXXXXXXXX" value={channel.phone} onChange={(event) => update(channel.channelType, { phone: event.target.value })} /></div>
        {channel.channelType === "viber" && <div className="field"><label>Viber link</label><input placeholder="viber://chat?number=..." value={channel.url} onChange={(event) => update(channel.channelType, { url: event.target.value })} /></div>}
      </div>}
      {(channel.channelType === "whatsapp" || channel.channelType === "website") && <div className="field"><label>{channel.channelType === "website" ? "Приветственное сообщение" : "Сообщение по умолчанию"}</label><textarea value={channel.defaultMessage} onChange={(event) => update(channel.channelType, { defaultMessage: event.target.value })} /></div>}
      <div className="form-grid">
        <div className="field"><label>Порядок отображения</label><input type="number" min="0" value={channel.sortOrder} onChange={(event) => update(channel.channelType, { sortOrder: Number(event.target.value) })} /></div>
        <div className="field"><label>Иконка</label><input value={channel.icon} onChange={(event) => update(channel.channelType, { icon: event.target.value })} /></div>
      </div>
    </section>)}
    <div className="action-row"><button className="button button-primary" type="button" disabled={busy || !channels.length} onClick={save}>{busy ? "Сохранение…" : "Сохранить настройки"}</button></div>
    {message && <p className="notice" role="status">{message}</p>}
  </div>;
}
