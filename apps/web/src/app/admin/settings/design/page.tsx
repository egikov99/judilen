import { SettingsNavigation } from "@/components/admin/settings-navigation";
import { SiteThemeEditor } from "@/components/admin/site-theme-editor";
import { requirePageAccess } from "@/lib/session";

export default async function AdminDesignSettingsPage() {
  await requirePageAccess("settings.manage");

  return <main className="admin-content">
    <h1 className="admin-title">Настройки</h1>
    <p className="admin-subtitle">Цветовая схема публичного сайта.</p>
    <SettingsNavigation active="design" />
    <SiteThemeEditor />
  </main>;
}
