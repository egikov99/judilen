import type { Metadata } from "next";
import { PasswordResetRequestForm } from "@/components/password-reset-forms";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Восстановление пароля", robots: { index: false, follow: false } };
export default function ForgotPasswordPage() {
  return <><SiteHeader /><main className="auth-page"><section className="auth-card"><h1>Восстановить доступ</h1><p style={{ color: "var(--muted)" }}>Укажите email аккаунта.</p><PasswordResetRequestForm /></section></main></>;
}

