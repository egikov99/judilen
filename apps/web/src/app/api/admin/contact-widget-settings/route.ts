import { contactWidgetSettings, db } from "@judilen/db";
import { asc } from "drizzle-orm";
import {
  buildContactChannelUrl,
  contactWidgetChannelTypes,
  contactWidgetSettingsSchema
} from "@/lib/contact-widget";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

const defaults = {
  telegram: ["Telegram", "Написать в Telegram", "telegram"],
  viber: ["Viber", "Написать в Viber", "viber"],
  whatsapp: ["WhatsApp", "Написать в WhatsApp", "whatsapp"],
  instagram: ["Instagram", "Открыть Instagram", "instagram"],
  website: ["Чат на сайте", "Напишите нам", "message-circle"]
} as const;

export async function GET() {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rows = await db.select().from(contactWidgetSettings).orderBy(asc(contactWidgetSettings.sortOrder));
  return Response.json({
    channels: contactWidgetChannelTypes.map((channelType, index) => {
      const row = rows.find((item) => item.channelType === channelType);
      return {
        channelType,
        enabled: row?.enabled ?? false,
        displayName: row?.displayName ?? defaults[channelType][0],
        subtitle: row?.subtitle ?? defaults[channelType][1],
        url: row?.url ?? "",
        phone: row?.phone ?? "",
        username: row?.username ?? "",
        defaultMessage: row?.defaultMessage ?? (channelType === "website" ? "Здравствуйте! Чем мы можем помочь?" : ""),
        sortOrder: row?.sortOrder ?? (index + 1) * 10,
        icon: row?.icon ?? defaults[channelType][2],
        status: row?.enabled && buildContactChannelUrl({
          channelType,
          enabled: row.enabled,
          displayName: row.displayName,
          subtitle: row.subtitle ?? "",
          url: row.url ?? "",
          phone: row.phone ?? "",
          username: row.username ?? "",
          defaultMessage: row.defaultMessage ?? "",
          sortOrder: row.sortOrder,
          icon: row.icon ?? ""
        }) ? "configured" : row?.enabled ? "invalid" : "disabled"
      };
    })
  });
}

export async function PUT(request: Request) {
  const auth = await requirePermission("settings.manage");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const parsed = contactWidgetSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте настройки каналов", parsed.error.flatten());
  await db.transaction(async (tx) => {
    for (const channel of parsed.data.channels) {
      const values = {
        enabled: channel.enabled,
        displayName: channel.displayName,
        subtitle: channel.subtitle || null,
        url: channel.url || null,
        phone: channel.phone || null,
        username: channel.username || null,
        defaultMessage: channel.defaultMessage || null,
        sortOrder: channel.sortOrder,
        icon: channel.icon || null,
        updatedAt: new Date()
      };
      await tx.insert(contactWidgetSettings).values({ channelType: channel.channelType, ...values })
        .onConflictDoUpdate({ target: contactWidgetSettings.channelType, set: values });
    }
  });
  return Response.json({ ok: true });
}
