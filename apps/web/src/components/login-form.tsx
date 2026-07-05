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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null) as {
        title?: string;
        user?: { role?: string };
      } | null;
      if (!response.ok) {
        setError(payload?.title ?? `Сервер не смог выполнить вход (HTTP ${response.status})`);
        return;
      }
      if (!payload?.user?.role) {
        setError("Сервер вернул некорректный ответ. Попробуйте ещё раз.");
        return;
      }
      const fallback = payload.user.role === "client" ? "/cabinet/trips" : "/admin";
      const requested = searchParams.get("next");
      const destination = requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : fallback;
      router.replace(destination);
      router.refresh();
    } catch (requestError) {
      if (process.env.NODE_ENV === "development") {
        console.error("Login request failed", requestError);
      }
      setError(controller.signal.aborted
        ? "Сервер не ответил за 15 секунд. Проверьте состояние приложения и базы данных."
        : "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.");
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
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
