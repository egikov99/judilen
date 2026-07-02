"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  applySiteTheme,
  DEFAULT_SITE_THEME,
  SITE_THEME_CSS_VARIABLES,
  siteThemeSchema,
  type SiteTheme
} from "@/lib/site-theme";

const fields: Array<{ key: keyof SiteTheme; label: string }> = [
  { key: "primaryColor", label: "Основной цвет сайта" },
  { key: "buttonColor", label: "Цвет кнопок" },
  { key: "buttonHoverColor", label: "Цвет кнопок при наведении" },
  { key: "backgroundColor", label: "Цвет фона" },
  { key: "cardColor", label: "Цвет карточек" },
  { key: "textColor", label: "Цвет текста" },
  { key: "accentColor", label: "Акцентный цвет" },
  { key: "headerColor", label: "Цвет шапки" },
  { key: "footerColor", label: "Цвет футера" }
];

function errorMessage(responseBody: unknown, fallback: string) {
  if (responseBody && typeof responseBody === "object" && "title" in responseBody) {
    return String(responseBody.title);
  }
  return fallback;
}

export function SiteThemeEditor() {
  const [theme, setTheme] = useState<SiteTheme>({ ...DEFAULT_SITE_THEME });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = useMemo(() => siteThemeSchema.safeParse(theme), [theme]);

  useEffect(() => {
    fetch("/api/site-theme", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Не удалось загрузить текущую палитру");
        const result = siteThemeSchema.safeParse(await response.json());
        if (!result.success) throw new Error("Сервер вернул некорректную палитру");
        setTheme(result.data);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const previewStyle = Object.fromEntries(
    Object.entries(SITE_THEME_CSS_VARIABLES).map(([key, variable]) => [variable, theme[key as keyof SiteTheme]])
  ) as CSSProperties;

  const update = (key: keyof SiteTheme, value: string) => {
    setMessage("");
    setTheme((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!parsed.success) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/site-theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data)
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(body, "Не удалось сохранить палитру"));
      const saved = siteThemeSchema.parse(body);
      setTheme(saved);
      applySiteTheme(saved);
      setMessage("Цветовая схема сохранена.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/site-theme/reset", { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(body, "Не удалось сбросить палитру"));
      const defaults = siteThemeSchema.parse(body);
      setTheme(defaults);
      applySiteTheme(defaults);
      setMessage("Восстановлена стандартная палитра.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка сброса");
    } finally {
      setBusy(false);
    }
  };

  return <div className="theme-editor">
    <section className="panel theme-fields">
      <h2>Цветовая схема</h2>
      <p className="theme-help">Используйте шестизначный HEX-код. Изменения применяются к публичному сайту.</p>
      <div className="theme-field-grid">
        {fields.map(({ key, label }) => {
          const valid = /^#[0-9A-Fa-f]{6}$/.test(theme[key]);
          return <label className="theme-field" key={key}>
            <span>{label}</span>
            <div className="theme-color-control">
              <input
                aria-label={`${label}: выбор цвета`}
                type="color"
                value={valid ? theme[key] : DEFAULT_SITE_THEME[key]}
                onChange={(event) => update(key, event.target.value.toUpperCase())}
              />
              <input
                aria-invalid={!valid}
                maxLength={7}
                spellCheck={false}
                value={theme[key]}
                onChange={(event) => update(key, event.target.value)}
              />
              <span className="theme-swatch" style={{ backgroundColor: valid ? theme[key] : "transparent" }} aria-hidden="true" />
            </div>
            {!valid && <small>Введите HEX в формате #RRGGBB</small>}
          </label>;
        })}
      </div>
      <div className="theme-actions">
        <button className="button button-primary" type="button" disabled={busy || loading || !parsed.success} onClick={save}>
          {busy ? "Подождите…" : "Сохранить"}
        </button>
        <button className="button button-ghost" type="button" disabled={busy || loading} onClick={reset}>Сбросить к стандартным</button>
      </div>
      {message && <p className="notice" role="status">{message}</p>}
    </section>

    <section className="theme-preview" style={previewStyle} aria-label="Предпросмотр цветовой схемы">
      <header><strong>Юдилен</strong><span>Предпросмотр шапки</span></header>
      <div className="theme-preview-page">
        <span className="theme-preview-accent">Отдых на природе</span>
        <h2>Заголовок страницы</h2>
        <article>
          <h3>Карточка домика</h3>
          <p>Так будут выглядеть основной текст, фон и карточки публичного сайта.</p>
          <button type="button">Забронировать</button>
        </article>
      </div>
      <footer>Предпросмотр футера</footer>
    </section>
  </div>;
}
