import Link from "next/link";

export function SettingsNavigation({ active }: { active: "general" | "design" | "email" | "contact" }) {
  return <nav className="settings-navigation" aria-label="Разделы настроек">
    <Link className={active === "general" ? "is-active" : ""} href="/admin/settings">Общие</Link>
    <Link className={active === "design" ? "is-active" : ""} href="/admin/settings/design">Дизайн</Link>
    <Link className={active === "email" ? "is-active" : ""} href="/admin/settings/email-templates">Email-шаблоны</Link>
    <Link className={active === "contact" ? "is-active" : ""} href="/admin/settings/contact-widget">Каналы связи</Link>
  </nav>;
}
