import { communicationChannels, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import {
  parseIncomingCommunicationMessages,
  verifyCommunicationWebhook
} from "@/lib/communication-adapters";
import { channelConfig } from "@/lib/communication-channels";
import { ingestCommunicationMessage } from "@/lib/communication-inbox";
import { isCommunicationProvider } from "@/lib/communication-types";

export const runtime = "nodejs";

async function findChannel(provider: string, secret: string) {
  if (!isCommunicationProvider(provider)) return null;
  const [channel] = await db.select().from(communicationChannels).where(and(
    eq(communicationChannels.provider, provider),
    eq(communicationChannels.webhookSecret, secret),
    eq(communicationChannels.isEnabled, true)
  )).limit(1);
  return channel ?? null;
}

export async function GET(request: Request, { params }: { params: Promise<{ provider: string; secret: string }> }) {
  const { provider, secret } = await params;
  const channel = await findChannel(provider, secret);
  if (!channel || (provider !== "instagram" && provider !== "whatsapp")) {
    return new Response("Not found", { status: 404 });
  }
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") !== "subscribe" || url.searchParams.get("hub.verify_token") !== secret) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", {
    headers: { "Content-Type": "text/plain" }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string; secret: string }> }) {
  const { provider, secret } = await params;
  const channel = await findChannel(provider, secret);
  if (!channel || !isCommunicationProvider(provider)) return new Response("Not found", { status: 404 });
  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const config = channelConfig(channel);
  if (!verifyCommunicationWebhook(config, rawBody, request.headers, payload)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (provider === "vk" && payload.type === "confirmation") {
    const confirmationCode = config.secretConfig.confirmationCode;
    return confirmationCode
      ? new Response(confirmationCode, { headers: { "Content-Type": "text/plain" } })
      : new Response("Confirmation code is not configured", { status: 503 });
  }

  const targets = [{ channel, config, provider }];
  if (provider === "telegram" || provider === "telegram_group") {
    const counterpartProvider = provider === "telegram" ? "telegram_group" : "telegram";
    const [counterpart] = await db.select().from(communicationChannels).where(and(
      eq(communicationChannels.provider, counterpartProvider),
      eq(communicationChannels.isEnabled, true)
    )).limit(1);
    if (counterpart) {
      const counterpartConfig = channelConfig(counterpart);
      if (counterpartConfig.secretConfig.botToken === config.secretConfig.botToken) {
        targets.push({ channel: counterpart, config: counterpartConfig, provider: counterpartProvider });
      }
    }
  }

  for (const target of targets) {
    const messages = parseIncomingCommunicationMessages(target.config, payload);
    for (const message of messages) {
      await ingestCommunicationMessage({
        id: target.channel.id,
        provider: target.provider,
        secretConfig: target.config.secretConfig
      }, message);
    }
  }
  return new Response(provider === "vk" ? "ok" : "EVENT_RECEIVED", {
    headers: { "Content-Type": "text/plain" }
  });
}
