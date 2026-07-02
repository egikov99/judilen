import { ContactWidgetSettings } from "@/components/admin/contact-widget-settings";
import { SettingsNavigation } from "@/components/admin/settings-navigation";
import { requirePageAccess } from "@/lib/session";

export default async function ContactWidgetSettingsPage() {
  await requirePageAccess("settings.manage");
  return <main className="admin-content">
    <h1 className="admin-title">Настройки</h1>
    <p className="admin-subtitle">Каналы связи и плавающий виджет публичного сайта.</p>
    <SettingsNavigation active="contact" />
    <ContactWidgetSettings />
  </main>;
}
