import { db, emailTemplates } from "@judilen/db";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";
import { SettingsNavigation } from "@/components/admin/settings-navigation";
import { DEFAULT_EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email-templates";
import { requirePageAccess } from "@/lib/session";

export default async function EmailTemplatesPage() {
  await requirePageAccess("settings.manage");
  const stored = await db.select().from(emailTemplates);
  const byKey = new Map(stored.map((item) => [item.key, item]));
  const templates = Object.values(DEFAULT_EMAIL_TEMPLATES).map((defaults) => {
    const value = byKey.get(defaults.key);
    return {
      key: defaults.key as EmailTemplateKey,
      name: defaults.name,
      subject: value?.subject ?? defaults.subject,
      htmlContent: value?.htmlContent ?? defaults.htmlContent,
      textContent: value?.textContent ?? defaults.textContent
    };
  });
  return <main className="admin-content">
    <h1 className="admin-title">Настройки</h1>
    <p className="admin-subtitle">Шаблоны автоматических писем клиентам.</p>
    <SettingsNavigation active="email" />
    <EmailTemplateEditor initialTemplates={templates} />
  </main>;
}
