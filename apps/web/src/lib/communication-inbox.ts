import "server-only";

import {
  chatConversations,
  chatMessages,
  communicationChannels,
  db
} from "@judilen/db";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createAdminNotification } from "./admin-notifications";
import { userIdsWithPermission } from "./permission-recipients";
import type { IncomingChannelMessage } from "./communication-adapters";
import type { CommunicationProvider } from "./communication-types";

export async function ingestCommunicationMessage(
  channel: { id: string; provider: CommunicationProvider },
  input: IncomingChannelMessage
) {
  const externalMessageId = input.externalMessageId || createHash("sha256")
    .update(JSON.stringify(input.rawPayload))
    .digest("hex");
  const receivedAt = new Date();

  const result = await db.transaction(async (tx) => {
    const [conversation] = await tx.insert(chatConversations).values({
      channelId: channel.id,
      externalChatId: input.externalChatId,
      externalUserId: input.externalUserId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      isGroup: input.isGroup
    }).onConflictDoUpdate({
      target: [chatConversations.channelId, chatConversations.externalChatId],
      set: {
        externalUserId: input.externalUserId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        isGroup: input.isGroup,
        updatedAt: receivedAt
      }
    }).returning({ id: chatConversations.id });

    const [message] = await tx.insert(chatMessages).values({
      conversationId: conversation.id,
      externalMessageId,
      direction: "inbound",
      senderName: input.senderName,
      body: input.body,
      status: "received",
      rawPayload: input.rawPayload
    }).onConflictDoNothing().returning({ id: chatMessages.id });
    if (!message) return { created: false, conversationId: conversation.id };

    await Promise.all([
      tx.update(chatConversations).set({
        unreadCount: sql`${chatConversations.unreadCount} + 1`,
        lastMessageAt: receivedAt,
        lastMessagePreview: input.body.slice(0, 240),
        updatedAt: receivedAt
      }).where(eq(chatConversations.id, conversation.id)),
      tx.update(communicationChannels).set({
        lastMessageAt: receivedAt,
        status: "connected",
        lastError: null,
        updatedAt: receivedAt
      }).where(and(
        eq(communicationChannels.id, channel.id),
        eq(communicationChannels.isEnabled, true)
      ))
    ]);
    return { created: true, conversationId: conversation.id, messageId: message.id };
  });

  if (result.created) {
    const isTelegramGroup = channel.provider === "telegram_group";
    const recipients = await userIdsWithPermission("chats.read");
    await createAdminNotification({
      eventType: "customer_message",
      title: isTelegramGroup ? "Новое сообщение из Telegram-группы" : "Новое сообщение от клиента",
      href: `/admin/chats?conversation=${result.conversationId}`,
      dedupeKey: `channel-message:${result.messageId}`,
      userIds: recipients
    });
  }
  return result;
}
