"use client";

import { useEffect, useMemo, useState } from "react";
import { tagManagerSettingsSchema, type TagManagerSettings } from "@/lib/tag-manager-config";

const emptySettings: TagManagerSettings = {
  tagManagerEnabled: false,
  tagManagerHeadCode: "",
  tagManagerBodyCode: ""
};

function errorMessage(responseBody: unknown, fallback: string) {
  if (responseBody && typeof responseBody === "object" && "title" in responseBody) {
    return String(responseBody.title);
  }
  return fallback;
}

export function TagManagerSettings() {
  const [settings, setSettings] = useState<TagManagerSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => tagManagerSettingsSchema.safeParse(settings), [settings]);

  useEffect(() => {
    fetch("/api/admin/tag-manager", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(errorMessage(body, "Не удалось загрузить настройки аналитики"));
        setSettings(tagManagerSettingsSchema.parse(body));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof TagManagerSettings, value: string | boolean) => {
    setMessage("");
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const save = async (nextSettings = settings, successMessage = "Настройки менеджера тегов сохранены.") => {
    const next = tagManagerSettingsSchema.safeParse(nextSettings);
    if (!next.success) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/tag-manager", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next.data)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(body, "Не удалось сохранить настройки аналитики"));
      setSettings(tagManagerSettingsSchema.parse(body));
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => save(emptySettings, "Код менеджера тегов очищен.");

  return <section className="panel settings-panel tag-manager-settings">
    <div className="settings-heading"><div><h2>Аналитика и менеджер тегов</h2><p>Код подключается только на публичных страницах сайта.</p></div></div>
    <p className="notice warning">Вставленный код выполняется в браузере посетителей. Добавляйте код только из доверенных источников.</p>
    <p className="theme-help">Вставьте код, предоставленный Google Tag Manager, Яндекс Метрикой или другим сервисом аналитики. Код будет подключён только на публичных страницах сайта и не будет работать в админке и личном кабинете клиента.</p>
    <label className="toggle-row">
      <input
        type="checkbox"
        checked={settings.tagManagerEnabled}
        disabled={loading || busy}
        onChange={(event) => update("tagManagerEnabled", event.currentTarget.checked)}
      />
      <span>Включить менеджер тегов</span>
    </label>
    <label className="field">
      <span>Код в &lt;head&gt;</span>
      <textarea
        value={settings.tagManagerHeadCode}
        onChange={(event) => update("tagManagerHeadCode", event.currentTarget.value)}
        maxLength={20_000}
        rows={8}
        spellCheck={false}
        disabled={loading || busy}
      />
    </label>
    <label className="field">
      <span>Код после открытия &lt;body&gt;</span>
      <textarea
        value={settings.tagManagerBodyCode}
        onChange={(event) => update("tagManagerBodyCode", event.currentTarget.value)}
        maxLength={20_000}
        rows={8}
        spellCheck={false}
        disabled={loading || busy}
      />
    </label>
    <div className="theme-actions">
      <button className="button button-primary" type="button" disabled={busy || loading || !parsed.success} onClick={() => save()}>
        {busy ? "Подождите…" : "Сохранить"}
      </button>
      <button className="button button-ghost" type="button" disabled={busy || loading} onClick={clear}>Очистить код</button>
    </div>
    {!parsed.success && <p className="notice error">Каждое поле кода должно быть не длиннее 20 000 символов.</p>}
    {message && <p className="notice" role="status">{message}</p>}
  </section>;
}
