import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Вход", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <><SiteHeader /><main className="auth-page"><section className="auth-card"><span className="eyebrow">Личный кабинет</span><h1>С возвращением</h1><p style={{ color: "var(--muted)", marginBottom: 28 }}>Войдите, чтобы увидеть поездки, оплаты и сообщения.</p><Suspense><LoginForm /></Suspense><p style={{ marginTop: 24, fontSize: 13 }}>Еще нет аккаунта? <Link className="text-link" href="/register">Зарегистрироваться</Link></p></section></main></>;
}
