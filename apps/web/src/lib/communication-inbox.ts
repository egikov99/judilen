import "server-only";

import {
  chatAttachments,
  chatConversations,
  chatMessages,
  communicationChannels,
  db
} from "@judilen/db";
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { createAdminNotification } from "./admin-notifications";
import { downloadTelegramAttachment, downloadVkAttachment } from "./chat-attachment-storage";
import { userIdsWithPermission } from "./permission-recipients";
import type { IncomingChannelMessage } from "./communication-adapters";
import type { CommunicationProvider } from "./communication-types";

export async function ingestCommunicationMessage(
  channel: { id: string; provider: CommunicationProvider; secretConfig?: Record<string, string> },
  input: IncomingChannelMessage
) {
  const externalMessageId = input.externalMessageId || createHash("sha256")
    .update(JSON.stringify(input.rawPayload))
    .digest("hex");
  const receivedAt = new Date();
  const preview = input.body
    || (input.attachments?.[0]?.kind === "image" ? "Фото" : input.attachments?.[0]?.title || input.attachments?.[0]?.fileName)
    || "[Вложение]";

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

    const [createdMessage] = await tx.insert(chatMessages).values({
      conversationId: conversation.id,
      externalMessageId,
      direction: "inbound",
      senderName: input.senderName,
      body: input.body,
      status: "received",
      rawPayload: input.rawPayload
    }).onConflictDoNothing().returning({ id: chatMessages.id });
    const [existingMessage] = createdMessage ? [] : await tx.select({ id: chatMessages.id })
      .from(chatMessages)
      .where(and(
        eq(chatMessages.conversationId, conversation.id),
        eq(chatMessages.externalMessageId, externalMessageId)
      ))
      .limit(1);
    const message = createdMessage ?? existingMessage;
    if (!message) return { created: false, conversationId: conversation.id, messageId: null };
    if (!createdMessage) return { created: false, conversationId: conversation.id, messageId: message.id };

    await Promise.all([
      tx.update(chatConversations).set({
        unreadCount: sql`${chatConversations.unreadCount} + 1`,
        lastMessageAt: receivedAt,
        lastMessagePreview: preview.slice(0, 240),
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

  if (result.messageId && input.attachments?.length && (
    channel.provider === "telegram"
    || channel.provider === "telegram_group"
    || channel.provider === "vk"
  )) {
    let saved = false;
    if (channel.provider === "vk" || channel.secretConfig?.botToken) {
      for (const attachment of input.attachments) {
        try {
          const stored = attachment.kind === "market"
            ? {
                kind: attachment.kind,
                fileName: attachment.fileName ?? null,
                mimeType: attachment.mimeType ?? null,
                sizeBytes: attachment.sizeBytes ?? null,
                storagePath: null,
                externalFileId: attachment.externalFileId,
                title: attachment.title || null,
                description: attachment.description || null,
                externalUrl: attachment.externalUrl || null,
                previewUrl: attachment.previewUrl || null,
                metadata: attachment.metadata ?? null
              }
            : channel.provider === "vk"
              ? await downloadVkAttachment(channel.id, attachment)
              : await downloadTelegramAttachment(channel.secretConfig?.botToken ?? "", channel.id, attachment);
          await db.insert(chatAttachments).values({
            messageId: result.messageId,
            ...stored
          }).onConflictDoNothing();
          saved = true;
        } catch (error) {
          console.error("communication_attachment_download_failed", {
            provider: channel.provider,
            channelId: channel.id,
            externalFileId: attachment.externalFileId,
            error
          });
        }
      }
    }
    if (!saved && !input.body) {
      await Promise.all([
        db.update(chatMessages).set({ body: "[Вложение]" }).where(eq(chatMessages.id, result.messageId)),
        db.update(chatConversations).set({ lastMessagePreview: "[Вложение]" })
          .where(eq(chatConversations.id, result.conversationId))
      ]);
    }
  }

  if (result.created) {
    const isTelegramGroup = channel.provider === "telegram_group";
    const recipients = await userIdsWithPermission("chats.read");
    await createAdminNotification({
      eventType: "customer_message",
      title: isTelegramGroup ? "Новое сообщение из Telegram-группы" : channel.provider === "website" ? "Новое сообщение с сайта" : "Новое сообщение от клиента",
      href: `/admin/chats?conversation=${result.conversationId}`,
      dedupeKey: `channel-message:${result.messageId}`,
      userIds: recipients
    });
  }
  return result;
}
