import "server-only";

import {
  chatConversations,
  chatMessages,
  communicationChannels,
  db,
  websiteChatVisitors
} from "@judilen/db";
import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";

export function hashWebsiteVisitorToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getWebsiteChannel(requireEnabled = false) {
  const [channel] = await db.select().from(communicationChannels).where(and(
    eq(communicationChannels.provider, "website"),
    requireEnabled ? eq(communicationChannels.isEnabled, true) : undefined
  )).limit(1);
  return channel ?? null;
}

export async function resolveWebsiteConversation(options: {
  channelId: string;
  visitorToken?: string | null;
  userId?: string | null;
  displayName?: string;
  contact?: string | null;
  create?: boolean;
}) {
  const visitorHash = options.visitorToken ? hashWebsiteVisitorToken(options.visitorToken) : null;
  const lockKey = options.userId ? `website-user:${options.userId}` : `website-visitor:${visitorHash}`;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
    const [visitorRow] = visitorHash ? await tx.select({ conversation: chatConversations })
      .from(websiteChatVisitors)
      .innerJoin(chatConversations, eq(websiteChatVisitors.conversationId, chatConversations.id))
      .where(and(
        eq(websiteChatVisitors.visitorHash, visitorHash),
        eq(chatConversations.channelId, options.channelId)
      ))
      .limit(1) : [];
    const [userConversation] = options.userId ? await tx.select().from(chatConversations).where(and(
      eq(chatConversations.channelId, options.channelId),
      eq(chatConversations.userId, options.userId)
    )).limit(1) : [];

    const visitorConversation = visitorRow?.conversation;
    const visitorBelongsToCurrentUser = !options.userId
      || !visitorConversation?.userId
      || visitorConversation.userId === options.userId;
    const safeVisitorConversation = visitorBelongsToCurrentUser ? visitorConversation : null;

    let conversation = safeVisitorConversation ?? userConversation ?? null;
    if (safeVisitorConversation && userConversation && safeVisitorConversation.id !== userConversation.id) {
      const guest = safeVisitorConversation;
      const canonical = userConversation;
      await tx.update(chatMessages).set({ conversationId: canonical.id }).where(eq(chatMessages.conversationId, guest.id));
      await tx.update(websiteChatVisitors).set({
        conversationId: canonical.id,
        lastSeenAt: new Date()
      }).where(eq(websiteChatVisitors.conversationId, guest.id));
      const guestIsNewer = (guest.lastMessageAt?.getTime() ?? 0) > (canonical.lastMessageAt?.getTime() ?? 0);
      const [updated] = await tx.update(chatConversations).set({
        unreadCount: canonical.unreadCount + guest.unreadCount,
        lastMessageAt: guestIsNewer ? guest.lastMessageAt : canonical.lastMessageAt,
        lastMessagePreview: guestIsNewer ? guest.lastMessagePreview : canonical.lastMessagePreview,
        displayName: options.displayName || canonical.displayName,
        externalUserId: options.contact || canonical.externalUserId,
        updatedAt: new Date()
      }).where(eq(chatConversations.id, canonical.id)).returning();
      await tx.delete(chatConversations).where(eq(chatConversations.id, guest.id));
      conversation = updated;
    }

    const isNew = !conversation;
    if (!conversation && options.create) {
      const [created] = await tx.insert(chatConversations).values({
        channelId: options.channelId,
        externalChatId: `website:${randomUUID()}`,
        externalUserId: options.contact || null,
        userId: options.userId || null,
        displayName: options.displayName || "Посетитель сайта",
        isGroup: false,
        status: "open"
      }).returning();
      conversation = created;
    }
    if (!conversation) return { conversation: null, isNew: false };

    const update: Partial<typeof chatConversations.$inferInsert> = {
      updatedAt: new Date(),
      ...(options.userId ? { userId: options.userId } : {}),
      ...(options.displayName ? { displayName: options.displayName } : {}),
      ...(options.contact ? { externalUserId: options.contact } : {})
    };
    const [updated] = await tx.update(chatConversations).set(update)
      .where(eq(chatConversations.id, conversation.id)).returning();
    conversation = updated;

    if (visitorHash) {
      await tx.insert(websiteChatVisitors).values({
        conversationId: conversation.id,
        visitorHash,
        lastSeenAt: new Date()
      }).onConflictDoUpdate({
        target: websiteChatVisitors.visitorHash,
        set: { conversationId: conversation.id, lastSeenAt: new Date() }
      });
    }
    return { conversation, isNew };
  });
}

export async function websiteChatRateLimited(conversationId: string, limit = 10) {
  const since = new Date(Date.now() - 60_000);
  const [row] = await db.select({ value: count() }).from(chatMessages).where(and(
    eq(chatMessages.conversationId, conversationId),
    eq(chatMessages.direction, "inbound"),
    gte(chatMessages.createdAt, since)
  ));
  return Number(row?.value ?? 0) >= limit;
}

export async function loadWebsiteMessages(conversationId: string, markRead: boolean) {
  const rows = await db.select().from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(300);
  const messages = rows.reverse();
  const unreadCount = messages.filter((message) => message.direction === "outbound" && !message.readAt).length;
  if (markRead && unreadCount) {
    await db.update(chatMessages).set({ readAt: new Date() }).where(and(
      eq(chatMessages.conversationId, conversationId),
      eq(chatMessages.direction, "outbound"),
      isNull(chatMessages.readAt)
    ));
  }
  return {
    unreadCount: markRead ? 0 : unreadCount,
    messages: messages.map((message) => ({
      id: message.id,
      senderType: message.direction === "outbound" ? "operator" as const : message.direction === "system" ? "system" as const : "client" as const,
      senderName: message.senderName,
      body: message.body,
      status: message.status,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString()
    }))
  };
}
