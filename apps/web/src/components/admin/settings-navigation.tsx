import Link from "next/link";

export function SettingsNavigation({ active }: { active: "general" | "design" }) {
  return <nav className="settings-navigation" aria-label="Разделы настроек">
    <Link className={active === "general" ? "is-active" : ""} href="/admin/settings">Общие</Link>
    <Link className={active === "design" ? "is-active" : ""} href="/admin/settings/design">Дизайн</Link>
  </nav>;
}
