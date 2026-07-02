import { communicationChannels, db } from "@judilen/db";
import { eq } from "drizzle-orm";
import { registerCommunicationWebhook, testCommunicationChannel } from "@/lib/communication-adapters";
import { channelConfig, communicationWebhookUrl } from "@/lib/communication-channels";
import { isCommunicationProvider } from "@/lib/communication-types";
import { requirePermission } from "@/lib/session";
import { problem } from "@/lib/validation";

export async function POST(_request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const auth = await requirePermission("integrations.update");
  if (auth.error === "unauthorized") return problem(401, "Требуется авторизация");
  if (auth.error === "forbidden") return problem(403, "Недостаточно прав");
  const { provider } = await params;
  if (!isCommunicationProvider(provider)) return problem(404, "Канал не найден");
  const [channel] = await db.select().from(communicationChannels)
    .where(eq(communicationChannels.provider, provider))
    .limit(1);
  if (!channel || !channel.isEnabled) return problem(404, "Сначала сохраните подключение");

  const checkedAt = new Date();
  try {
    const config = channelConfig(channel);
    const account = await testCommunicationChannel(config);
    await registerCommunicationWebhook(config, communicationWebhookUrl(channel));
    await db.update(communicationChannels).set({
      status: "connected",
      lastCheckedAt: checkedAt,
      lastError: null,
      updatedAt: checkedAt
    }).where(eq(communicationChannels.id, channel.id));
    return Response.json({ ok: true, account, webhookUrl: communicationWebhookUrl(channel) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка подключения";
    await db.update(communicationChannels).set({
      status: "error",
      lastCheckedAt: checkedAt,
      lastError: message,
      updatedAt: checkedAt
    }).where(eq(communicationChannels.id, channel.id));
    return problem(502, "Проверка подключения не пройдена", message);
  }
}
