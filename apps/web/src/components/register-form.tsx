"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function RegisterForm() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, consent: form.consent === "on" })
    });
    const payload = await response.json();
    if (!response.ok) return setStatus(payload.title ?? "Не удалось зарегистрироваться");
    router.replace("/cabinet/trips");
    router.refresh();
  }
  return <form className="form-stack" onSubmit={submit}>
    {status && status !== "loading" && <div className="notice error">{status}</div>}
    <div className="form-grid"><div className="field"><label htmlFor="firstName">Имя</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div><div className="field"><label htmlFor="lastName">Фамилия</label><input id="lastName" name="lastName" autoComplete="family-name" /></div></div>
    <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
    <div className="field"><label htmlFor="phone">Телефон</label><input id="phone" name="phone" type="tel" autoComplete="tel" required /></div>
    <div className="field"><label htmlFor="password">Пароль</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /><small>Минимум 10 символов, буквы и цифры.</small></div>
    <label style={{ display: "flex", gap: 8, fontSize: 12 }}><input name="consent" type="checkbox" required /> <span>Согласен с <Link href="/privacy" target="_blank">политикой конфиденциальности</Link></span></label>
    <button className="button button-primary" disabled={status === "loading"}>{status === "loading" ? "Создаем…" : "Создать аккаунт"}</button>
  </form>;
}
