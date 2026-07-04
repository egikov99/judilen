import { chatAttachments, chatConversations, chatMessages, communicationChannels, db } from "@judilen/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("chats.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const [conversation] = await db.select({
    id: chatConversations.id,
    provider: communicationChannels.provider,
    displayName: chatConversations.displayName,
    isGroup: chatConversations.isGroup,
    status: chatConversations.status
  }).from(chatConversations)
    .innerJoin(communicationChannels, eq(chatConversations.channelId, communicationChannels.id))
    .where(eq(chatConversations.id, id))
    .limit(1);
  if (!conversation) return problem(404, "Чат не найден");
  const messages = await db.select().from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(asc(chatMessages.createdAt))
    .limit(300);
  const attachments = messages.length
    ? await db.select().from(chatAttachments)
        .where(inArray(chatAttachments.messageId, messages.map((item) => item.id)))
        .orderBy(asc(chatAttachments.createdAt))
    : [];
  return Response.json({
    conversation,
    messages: messages.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      attachments: attachments.filter((attachment) => attachment.messageId === item.id).map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        url: `/api/admin/chat-attachments/${attachment.id}`
      }))
    }))
  });
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission("chats.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { id } = await params;
  const now = new Date();
  const [conversation] = await db.update(chatConversations).set({
    unreadCount: 0,
    updatedAt: now
  }).where(and(
    eq(chatConversations.id, id),
    sql`${chatConversations.unreadCount} > 0`
  )).returning({ id: chatConversations.id });
  await db.update(chatMessages).set({ readAt: now }).where(and(
    eq(chatMessages.conversationId, id),
    eq(chatMessages.direction, "inbound"),
    sql`${chatMessages.readAt} is null`
  ));
  return Response.json({ ok: true, changed: Boolean(conversation) });
}
