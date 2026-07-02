import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordResetConfirmForm } from "@/components/password-reset-forms";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Новый пароль", robots: { index: false, follow: false } };
export default function ResetPasswordPage() {
  return <><SiteHeader /><main className="auth-page public-site"><section className="auth-card"><h1>Новый пароль</h1><p style={{ color: "var(--muted)" }}>Используйте уникальный пароль длиной не менее 10 символов.</p><Suspense><PasswordResetConfirmForm /></Suspense></section></main></>;
}
