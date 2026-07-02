import { communicationChannels, db, vkIntegrations } from "@judilen/db";
import { eq } from "drizzle-orm";
import { testCommunicationChannel } from "@/lib/communication-adapters";
import { channelConfig } from "@/lib/communication-channels";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST() {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const [integration] = await db.select().from(vkIntegrations).limit(1);
  if (!integration?.communicationChannelId) return problem(404, "Сначала сохраните настройки VK");
  const [channel] = await db.select().from(communicationChannels)
    .where(eq(communicationChannels.id, integration.communicationChannelId))
    .limit(1);
  if (!channel?.isEnabled) return problem(404, "Интеграция VK отключена");

  const checkedAt = new Date();
  try {
    const account = await testCommunicationChannel(channelConfig(channel));
    await Promise.all([
      db.update(vkIntegrations).set({
        groupName: account,
        status: integration.status === "connected" ? "connected" : "pending",
        updatedAt: checkedAt
      }).where(eq(vkIntegrations.id, integration.id)),
      db.update(communicationChannels).set({
        lastCheckedAt: checkedAt,
        lastError: null,
        updatedAt: checkedAt
      }).where(eq(communicationChannels.id, channel.id))
    ]);
    return Response.json({ ok: true, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка подключения";
    await Promise.all([
      db.update(vkIntegrations).set({ status: "error", updatedAt: checkedAt })
        .where(eq(vkIntegrations.id, integration.id)),
      db.update(communicationChannels).set({
        status: "error",
        lastCheckedAt: checkedAt,
        lastError: message,
        updatedAt: checkedAt
      }).where(eq(communicationChannels.id, channel.id))
    ]);
    return problem(502, "Проверка подключения не пройдена", message);
  }
}
