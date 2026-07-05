"use client";

import { useEffect, useState } from "react";

export function PasswordResetRequestForm() {
  const [status, setStatus] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));
    await fetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setStatus("Если такой email зарегистрирован, мы отправили ссылку для восстановления.");
  }
  return <form className="form-stack" onSubmit={submit}>{status && <div className="notice">{status}</div>}<div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div><button className="button button-primary">Получить ссылку</button></form>;
}

export function PasswordResetConfirmForm() {
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") ?? "";
    const timer = window.setTimeout(() => setToken(value), 0);
    if (value) window.history.replaceState(null, "", "/reset-password");
    return () => window.clearTimeout(timer);
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const payload = await response.json();
    setStatus(response.ok ? "Пароль изменен. Теперь можно войти." : payload.title ?? "Не удалось изменить пароль");
  }
  return <form className="form-stack" onSubmit={submit}>{status && <div className={`notice ${status.startsWith("Пароль") ? "" : "error"}`}>{status}</div>}<div className="field"><label htmlFor="password">Новый пароль</label><input id="password" name="password" type="password" minLength={10} required /></div><button className="button button-primary" disabled={!token}>Сохранить пароль</button>{!token && <p className="notice error">Ссылка восстановления недействительна.</p>}</form>;
}
