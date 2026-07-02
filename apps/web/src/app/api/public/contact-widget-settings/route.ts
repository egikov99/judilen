import { contactWidgetSettings, db } from "@judilen/db";
import { asc, eq } from "drizzle-orm";
import { buildContactChannelUrl, contactWidgetChannelSchema } from "@/lib/contact-widget";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(contactWidgetSettings).where(
    eq(contactWidgetSettings.enabled, true)
  ).orderBy(asc(contactWidgetSettings.sortOrder));
  const channels = rows.flatMap((row) => {
    const parsed = contactWidgetChannelSchema.safeParse({
      channelType: row.channelType,
      enabled: row.enabled,
      displayName: row.displayName,
      subtitle: row.subtitle ?? "",
      url: row.url ?? "",
      phone: row.phone ?? "",
      username: row.username ?? "",
      defaultMessage: row.defaultMessage ?? "",
      sortOrder: row.sortOrder,
      icon: row.icon ?? ""
    });
    if (!parsed.success) return [];
    const url = buildContactChannelUrl(parsed.data);
    if (!url) return [];
    return [{
      type: parsed.data.channelType,
      displayName: parsed.data.displayName,
      subtitle: parsed.data.subtitle,
      url: parsed.data.channelType === "website" ? null : url,
      greeting: parsed.data.channelType === "website" ? parsed.data.defaultMessage : null,
      icon: parsed.data.icon
    }];
  });
  return Response.json({ channels }, { headers: { "Cache-Control": "no-store" } });
}
