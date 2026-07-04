import { contactWidgetSettings, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { ingestCommunicationMessage } from "@/lib/communication-inbox";
import { getSession } from "@/lib/session";
import {
  getWebsiteChannel,
  loadWebsiteMessages,
  resolveWebsiteConversation,
  websiteChatRateLimited
} from "@/lib/website-chat";
import { problem } from "@/lib/validation";

const visitorTokenSchema = z.string().min(32).max(200).regex(/^[A-Za-z0-9_-]+$/);
const contactSchema = z.string().trim().min(5).max(254).refine((value) => (
  z.email().safeParse(value).success || /^\+?[\d\s()-]{7,30}$/.test(value)
), "Введите корректный телефон или email");
const messageSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  contact: contactSchema.optional(),
  message: z.string().trim().min(1).max(4000),
  website: z.string().max(0).optional().default("")
});

function visitorToken(request: Request) {
  const value = request.headers.get("x-chat-visitor");
  return value && visitorTokenSchema.safeParse(value).success ? value : null;
}

export async function GET(request: Request) {
  const session = await getSession();
  const token = visitorToken(request);
  if (!session && !token) return problem(401, "Не удалось определить посетителя");
  const channel = await getWebsiteChannel();
  if (!channel) return problem(503, "Чат временно недоступен");
  const resolved = await resolveWebsiteConversation({
    channelId: channel.id,
    visitorToken: token,
    userId: session?.userId,
    displayName: session?.name,
    contact: session?.email,
    create: false
  });
  if (!resolved.conversation) {
    return Response.json({ conversationId: null, authenticated: Boolean(session), unreadCount: 0, messages: [] }, {
      headers: { "Cache-Control": "no-store" }
    });
  }
  const markRead = new URL(request.url).searchParams.get("markRead") !== "0";
  const history = await loadWebsiteMessages(resolved.conversation.id, markRead);
  return Response.json({
    conversationId: resolved.conversation.id,
    authenticated: Boolean(session),
    profile: {
      name: session?.name ?? resolved.conversation.displayName,
      contact: session?.email ?? resolved.conversation.externalUserId ?? ""
    },
    ...history
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Проверьте имя, контакт и сообщение", parsed.error.flatten());
  const session = await getSession();
  const token = visitorToken(request);
  if (!session && !token) return problem(401, "Не удалось определить посетителя");

  const [settings, channel] = await Promise.all([
    db.select({ id: contactWidgetSettings.id }).from(contactWidgetSettings).where(and(
      eq(contactWidgetSettings.channelType, "website"),
      eq(contactWidgetSettings.enabled, true)
    )).limit(1).then((rows) => rows[0] ?? null),
    getWebsiteChannel(true)
  ]);
  if (!settings) return problem(404, "Чат на сайте отключён");
  if (!channel) return problem(503, "Чат временно недоступен");

  const name = session?.name ?? parsed.data.name;
  const contact = session?.email ?? parsed.data.contact;
  if (!name || !contact) return problem(422, "Укажите имя и телефон или email");
  const resolved = await resolveWebsiteConversation({
    channelId: channel.id,
    visitorToken: token,
    userId: session?.userId,
    displayName: name,
    contact,
    create: true
  });
  if (!resolved.conversation) return problem(500, "Не удалось создать чат");
  if (await websiteChatRateLimited(resolved.conversation.id)) {
    return problem(429, "Слишком много сообщений", "Подождите минуту и попробуйте снова");
  }

  const result = await ingestCommunicationMessage({ id: channel.id, provider: "website" }, {
    externalChatId: resolved.conversation.externalChatId,
    externalUserId: contact,
    externalMessageId: crypto.randomUUID(),
    displayName: name,
    avatarUrl: null,
    isGroup: false,
    senderName: name,
    body: parsed.data.message,
    rawPayload: {
      source: "website_widget",
      channel: "website",
      contact,
      userId: session?.userId ?? null
    }
  });
  const history = await loadWebsiteMessages(result.conversationId, true);
  return Response.json({
    success: true,
    conversationId: result.conversationId,
    authenticated: Boolean(session),
    ...history
  }, { status: resolved.isNew ? 201 : 200 });
}
