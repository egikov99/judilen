import { communicationChannels, contactWidgetSettings, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ingestCommunicationMessage } from "@/lib/communication-inbox";
import { problem } from "@/lib/validation";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  contact: z.string().trim().min(5).max(254).refine((value) => (
    z.email().safeParse(value).success || /^\+?[\d\s()-]{7,30}$/.test(value)
  ), "Введите корректный телефон или email"),
  message: z.string().trim().min(2).max(4000),
  website: z.string().max(0).optional().default("")
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте имя, контакт и сообщение", parsed.error.flatten());
  const [settings] = await db.select({ id: contactWidgetSettings.id })
    .from(contactWidgetSettings)
    .where(and(
      eq(contactWidgetSettings.channelType, "website"),
      eq(contactWidgetSettings.enabled, true)
    )).limit(1);
  if (!settings) return problem(404, "Чат на сайте отключён");
  const [channel] = await db.select({ id: communicationChannels.id })
    .from(communicationChannels)
    .where(and(
      eq(communicationChannels.provider, "website"),
      eq(communicationChannels.isEnabled, true)
    )).limit(1);
  if (!channel) return problem(503, "Чат временно недоступен");

  const messageId = crypto.randomUUID();
  const result = await ingestCommunicationMessage({
    id: channel.id,
    provider: "website"
  }, {
    externalChatId: crypto.randomUUID(),
    externalUserId: parsed.data.contact,
    externalMessageId: messageId,
    displayName: `${parsed.data.name} · сайт`,
    avatarUrl: null,
    isGroup: false,
    senderName: parsed.data.name,
    body: `${parsed.data.message}\n\nКонтакт: ${parsed.data.contact}`,
    rawPayload: {
      source: "website_widget",
      channel: "website",
      contact: parsed.data.contact
    }
  });
  return Response.json({ ok: true, conversationId: result.conversationId }, { status: 201 });
}
