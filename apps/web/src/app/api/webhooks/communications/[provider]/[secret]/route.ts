import { communicationChannels, db } from "@judilen/db";
import { and, eq } from "drizzle-orm";
import {
  parseIncomingCommunicationMessages,
  verifyCommunicationWebhook
} from "@/lib/communication-adapters";
import { channelConfig } from "@/lib/communication-channels";
import { ingestCommunicationMessage } from "@/lib/communication-inbox";
import { isCommunicationProvider } from "@/lib/communication-types";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { readRequestTextLimited, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";

async function findChannel(provider: string, secret: string) {
  if (!isCommunicationProvider(provider)) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(secret)) return null;
  const [channel] = await db.select().from(communicationChannels).where(and(
    eq(communicationChannels.provider, provider),
    eq(communicationChannels.id, secret),
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
  const verifyToken = url.searchParams.get("hub.verify_token");
  if (
    url.searchParams.get("hub.mode") !== "subscribe"
    || (verifyToken !== channel.id && verifyToken !== channel.webhookSecret)
  ) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(url.searchParams.get("hub.challenge") ?? "", {
    headers: { "Content-Type": "text/plain" }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ provider: string; secret: string }> }) {
  const { provider, secret } = await params;
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_048_576) return new Response("Payload too large", { status: 413 });
  const rate = await checkRateLimit(request, {
    scope: `webhook.${provider}`,
    limit: 600,
    windowMs: 60_000
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  const channel = await findChannel(provider, secret);
  if (!channel || !isCommunicationProvider(provider)) return new Response("Not found", { status: 404 });
  let rawBody: string;
  try {
    rawBody = await readRequestTextLimited(request, 1_048_576);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return new Response("Payload too large", { status: 413 });
    throw error;
  }
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
  const safePayload = { ...payload };
  delete safePayload.secret;

  if (provider === "vk" && safePayload.type === "confirmation") {
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
    const messages = parseIncomingCommunicationMessages(target.config, safePayload);
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
