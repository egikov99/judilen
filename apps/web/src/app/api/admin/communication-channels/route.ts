import {
  chatConversations,
  chatMessages,
  communicationChannels,
  db
} from "@judilen/db";
import { and, desc, eq } from "drizzle-orm";
import { channelConfig, communicationWebhookUrl } from "@/lib/communication-channels";
import { communicationProviders } from "@/lib/communication-types";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("integrations.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const updateAccess = await requirePermission("integrations.update");
  const canManage = updateAccess.error === null;

  const rows = await db.select().from(communicationChannels).orderBy(communicationChannels.provider);
  const group = rows.find((item) => item.provider === "telegram_group");
  const recentGroupMessages = group
    ? await db.select({
        id: chatMessages.id,
        body: chatMessages.body,
        senderName: chatMessages.senderName,
        createdAt: chatMessages.createdAt
      }).from(chatMessages)
        .innerJoin(chatConversations, eq(chatMessages.conversationId, chatConversations.id))
        .where(and(
          eq(chatConversations.channelId, group.id),
          eq(chatMessages.direction, "inbound")
        ))
        .orderBy(desc(chatMessages.createdAt))
        .limit(5)
    : [];

  return Response.json({
    items: communicationProviders.map((provider) => {
      const row = rows.find((item) => item.provider === provider);
      if (!row) return { provider, status: "disconnected", isEnabled: false, publicConfig: {}, secretKeys: [], webhookUrl: null };
      return {
        provider,
        status: row.status,
        isEnabled: row.isEnabled,
        publicConfig: row.publicConfig,
        secretKeys: canManage ? Object.keys(channelConfig(row).secretConfig) : [],
        webhookUrl: canManage ? communicationWebhookUrl(row) : null,
        lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
        lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
        lastError: row.lastError
      };
    }),
    recentGroupMessages: recentGroupMessages.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString()
    }))
  });
}
