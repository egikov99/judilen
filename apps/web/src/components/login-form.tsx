"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) return setError(payload.title ?? "Не удалось войти");
    const fallback = payload.user.role === "client" ? "/cabinet/trips" : "/admin";
    router.replace(searchParams.get("next") ?? fallback);
    router.refresh();
  }
  return (
    <form className="form-stack" onSubmit={submit}>
      {error && <div className="notice error" role="alert">{error}</div>}
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Пароль</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
      <button className="button button-primary" disabled={loading} type="submit">{loading ? "Входим…" : "Войти"}</button>
      <Link className="text-link" href="/forgot-password">Забыли пароль?</Link>
    </form>
  );
}
