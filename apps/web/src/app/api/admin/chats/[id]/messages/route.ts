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

const messageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("chats.write");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
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
    return Response.json({ item: { ...message, createdAt: message.createdAt.toISOString() } }, { status: 201 });
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
    return Response.json({ item: { ...sent, createdAt: sent.createdAt.toISOString() } }, { status: 201 });
  } catch (error) {
    await db.update(chatMessages).set({ status: "failed" }).where(eq(chatMessages.id, message.id));
    return problem(502, "Сообщение не отправлено", error instanceof Error ? error.message : undefined);
  }
}
