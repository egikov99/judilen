import { PushSettings } from "@/components/admin/push-settings";
import { SettingsNavigation } from "@/components/admin/settings-navigation";
import { TagManagerSettings } from "@/components/admin/tag-manager-settings";
import { requirePageAccess } from "@/lib/session";

export default async function AdminSettingsPage() {
  await requirePageAccess("settings.manage");
  return <main className="admin-content">
    <h1 className="admin-title">Настройки</h1>
    <p className="admin-subtitle">Установка приложения и персональные уведомления.</p>
    <SettingsNavigation active="general" />
    <TagManagerSettings />
    <PushSettings />
  </main>;
}
