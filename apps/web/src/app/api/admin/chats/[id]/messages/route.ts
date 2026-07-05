import {
  chatConversations,
  chatMessages,
  communicationChannels,
  db
} from "@judilen/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { sendCommunicationMessage } from "@/lib/communication-adapters";
import { channelConfig } from "@/lib/communication-channels";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";
import { safeErrorForLog } from "@/lib/redaction";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";

const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

function messageResponse(message: typeof chatMessages.$inferSelect) {
  return {
    id: message.id,
    direction: message.direction,
    senderName: message.senderName,
    body: message.body,
    status: message.status,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString()
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("chats.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const rate = await checkRateLimit(request, {
    scope: "admin.chat-message",
    limit: 120,
    windowMs: 60 * 60_000,
    identifier: auth.session.userId
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const parsed = messageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return problem(422, "Введите сообщение", parsed.error.flatten());
  const { id } = await params;
  const [row] = await db.select({
    conversation: chatConversations,
    channel: communicationChannels
  }).from(chatConversations)
    .innerJoin(communicationChannels, eq(chatConversations.channelId, communicationChannels.id))
    .where(eq(chatConversations.id, id))
    .limit(1);
  if (!row) return problem(404, "Чат не найден");
  if (!row.channel.isEnabled || row.channel.status !== "connected") {
    return problem(409, "Канал отключён или не прошёл проверку");
  }
  const now = new Date();
  if (row.channel.provider === "website") {
    const [message] = await db.insert(chatMessages).values({
      conversationId: id,
      direction: "outbound",
      senderName: auth.session.name,
      body: parsed.data.body,
      status: "sent",
      sentByUserId: auth.session.userId
    }).returning();
    await db.update(chatConversations).set({
      lastMessageAt: now,
      lastMessagePreview: parsed.data.body.slice(0, 240),
      updatedAt: now
    }).where(eq(chatConversations.id, id));
    return Response.json({ item: messageResponse(message) }, { status: 201 });
  }

  const [message] = await db.insert(chatMessages).values({
    conversationId: id,
    direction: "outbound",
    senderName: auth.session.name,
    body: parsed.data.body,
    status: "pending",
    sentByUserId: auth.session.userId
  }).returning();
  try {
    const externalMessageId = await sendCommunicationMessage(
      channelConfig(row.channel),
      row.conversation.externalChatId,
      parsed.data.body
    );
    const [sent] = await db.update(chatMessages).set({
      status: "sent",
      externalMessageId: externalMessageId || null
    }).where(eq(chatMessages.id, message.id)).returning();
    await db.update(chatConversations).set({
      lastMessageAt: now,
      lastMessagePreview: parsed.data.body.slice(0, 240),
      updatedAt: now
    }).where(eq(chatConversations.id, id));
    return Response.json({ item: messageResponse(sent) }, { status: 201 });
  } catch (error) {
    await db.update(chatMessages).set({ status: "failed" }).where(eq(chatMessages.id, message.id));
    console.error("communication_message_send_failed", {
      conversationId: id,
      provider: row.channel.provider,
      error: safeErrorForLog(error)
    });
    return problem(502, "Сообщение не отправлено");
  }
}
