import { chatConversations, communicationChannels, db } from "@judilen/db";
import { desc, sql } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function GET() {
  const auth = await requirePermission("chats.read");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const items = await db.select({
    id: chatConversations.id,
    provider: communicationChannels.provider,
    displayName: chatConversations.displayName,
    avatarUrl: chatConversations.avatarUrl,
    isGroup: chatConversations.isGroup,
    status: chatConversations.status,
    unreadCount: chatConversations.unreadCount,
    lastMessageAt: chatConversations.lastMessageAt,
    lastMessagePreview: chatConversations.lastMessagePreview
  }).from(chatConversations)
    .innerJoin(communicationChannels, sql`${communicationChannels.id} = ${chatConversations.channelId}`)
    .orderBy(desc(chatConversations.lastMessageAt))
    .limit(100);
  const totalUnread = items.reduce((sum, item) => sum + item.unreadCount, 0);
  return Response.json({
    items: items.map((item) => ({
      ...item,
      lastMessageAt: item.lastMessageAt?.toISOString() ?? null
    })),
    totalUnread
  });
}
