import type { Metadata } from "next";
import { RegisterForm } from "@/components/register-form";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Регистрация", robots: { index: false, follow: false } };
export default function RegisterPage() {
  return <><SiteHeader /><main className="auth-page"><section className="auth-card" style={{ width: "min(570px,100%)" }}><span className="eyebrow">Личный кабинет</span><h1>Создать аккаунт</h1><p style={{ color: "var(--muted)" }}>Управляйте поездками и получайте документы в одном месте.</p><RegisterForm /></section></main></>;
}

