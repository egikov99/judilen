import {
  communicationChannels,
  db,
  vkEventsLog,
  vkIntegrations
} from "@judilen/db";
import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { parseIncomingCommunicationMessages } from "@/lib/communication-adapters";
import { channelConfig } from "@/lib/communication-channels";
import { ingestCommunicationMessage } from "@/lib/communication-inbox";
import {
  decryptVkSecret,
  vkEventId,
  vkEventTypes
} from "@/lib/vk-integration";
import { checkRateLimit, rateLimitProblem } from "@/lib/rate-limit";
import { readRequestTextLimited, RequestBodyTooLargeError } from "@/lib/request-body";

export const runtime = "nodejs";

function plain(body: string, status: number, eventType: string, groupId: string) {
  console.info("vk_callback_response", {
    statusCode: status,
    eventType: eventType || null,
    groupId: groupId || null
  });
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function persistConfiguredConfirmation(
  groupId: string,
  payload: Record<string, unknown>,
  rawBody: string
) {
  const [integration] = await db.select().from(vkIntegrations)
    .where(eq(vkIntegrations.groupId, groupId))
    .limit(1);
  if (!integration) return;
  const now = new Date();
  await Promise.all([
    db.update(vkIntegrations).set({
      status: "connected",
      lastConfirmedAt: now,
      lastEventAt: now,
      updatedAt: now
    }).where(eq(vkIntegrations.id, integration.id)),
    integration.communicationChannelId
      ? db.update(communicationChannels).set({
          status: "connected",
          lastError: null,
          updatedAt: now
        }).where(eq(communicationChannels.id, integration.communicationChannelId))
      : Promise.resolve(),
    db.insert(vkEventsLog).values({
      integrationId: integration.id,
      groupId,
      eventType: "confirmation",
      eventId: vkEventId(payload, rawBody),
      payload,
      status: "processed"
    }).onConflictDoNothing()
  ]);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_048_576) return plain("payload too large", 413, "", "");
  const rate = await checkRateLimit(request, {
    scope: "webhook.vk-callback",
    limit: 600,
    windowMs: 60_000
  });
  if (!rate.allowed) return rateLimitProblem(rate.retryAfter);
  let rawBody: string;
  try {
    rawBody = await readRequestTextLimited(request, 1_048_576);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return plain("payload too large", 413, "", "");
    throw error;
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return plain("invalid json", 400, "", "");
  }

  const groupId = text(payload.group_id);
  const eventType = text(payload.type);
  if (!groupId || !eventType) return plain("invalid event", 400, eventType, groupId);
  const safePayload = { ...payload };
  delete safePayload.secret;

  const configuredGroupId = process.env.VK_GROUP_ID?.trim();
  const configuredConfirmationToken = process.env.VK_CONFIRMATION_TOKEN?.trim();
  const configuredSecretKey = process.env.VK_SECRET_KEY?.trim();
  if (
    eventType === "confirmation"
    && configuredGroupId === groupId
    && configuredConfirmationToken
    && configuredSecretKey
    && secureEquals(text(payload.secret), configuredSecretKey)
  ) {
    void persistConfiguredConfirmation(groupId, safePayload, rawBody).catch((error) => {
      console.error("vk_callback_confirmation_persistence_failed", {
        eventType,
        groupId,
        error
      });
    });
    return plain(configuredConfirmationToken, 200, eventType, groupId);
  }

  let integration: typeof vkIntegrations.$inferSelect | undefined;
  try {
    [integration] = await db.select().from(vkIntegrations)
      .where(eq(vkIntegrations.groupId, groupId))
      .limit(1);
  } catch (error) {
    console.error("vk_callback_integration_lookup_failed", { eventType, groupId, error });
    return plain("ok", 200, eventType, groupId);
  }
  if (!integration || integration.status === "not_configured") {
    return plain("ok", 200, eventType, groupId);
  }

  const now = new Date();
  if (eventType === "confirmation") {
    if (!secureEquals(text(payload.secret), decryptVkSecret(integration.secretKey))) {
      return plain("ok", 200, eventType, groupId);
    }
    const confirmationToken = decryptVkSecret(integration.confirmationToken);
    if (!confirmationToken) return plain("ok", 200, eventType, groupId);
    try {
      await Promise.all([
        db.update(vkIntegrations).set({
          status: "connected",
          lastConfirmedAt: now,
          lastEventAt: now,
          updatedAt: now
        }).where(eq(vkIntegrations.id, integration.id)),
        integration.communicationChannelId
          ? db.update(communicationChannels).set({
              status: "connected",
              lastError: null,
              updatedAt: now
            }).where(eq(communicationChannels.id, integration.communicationChannelId))
          : Promise.resolve(),
        db.insert(vkEventsLog).values({
          integrationId: integration.id,
          groupId,
          eventType,
          eventId: vkEventId(payload, rawBody),
          payload: safePayload,
          status: "processed"
        }).onConflictDoNothing()
      ]);
    } catch (error) {
      console.error("vk_callback_confirmation_persistence_failed", { eventType, groupId, error });
    }
    return plain(confirmationToken, 200, eventType, groupId);
  }

  if (
    (!integration.lastConfirmedAt || integration.status === "pending")
    && configuredGroupId !== groupId
  ) {
    return plain("ok", 200, eventType, groupId);
  }
  if (!secureEquals(text(payload.secret), decryptVkSecret(integration.secretKey))) {
    return plain("ok", 200, eventType, groupId);
  }
  if (!vkEventTypes.has(eventType)) return plain("ok", 200, eventType, groupId);

  try {
    const eventId = vkEventId(payload, rawBody);
    const [createdEvent] = await db.insert(vkEventsLog).values({
      integrationId: integration.id,
      groupId,
      eventType,
      eventId,
      payload: safePayload,
      status: "processing"
    }).onConflictDoNothing().returning({ id: vkEventsLog.id });
    let logId = createdEvent?.id;
    if (!logId) {
      const [existingEvent] = await db.select({
        id: vkEventsLog.id,
        status: vkEventsLog.status
      }).from(vkEventsLog).where(and(
        eq(vkEventsLog.integrationId, integration.id),
        eq(vkEventsLog.eventId, eventId)
      )).limit(1);
      if (!existingEvent || existingEvent.status !== "error") {
        return plain("ok", 200, eventType, groupId);
      }
      logId = existingEvent.id;
      await db.update(vkEventsLog).set({ status: "processing", errorMessage: null })
        .where(eq(vkEventsLog.id, logId));
    }

    if (eventType === "message_new") {
      if (!integration.communicationChannelId) throw new Error("VK communication channel is not configured");
      const [channel] = await db.select().from(communicationChannels)
        .where(and(
          eq(communicationChannels.id, integration.communicationChannelId),
          eq(communicationChannels.isEnabled, true)
        ))
        .limit(1);
      if (!channel) throw new Error("VK communication channel is disabled");
      const config = channelConfig(channel);
      for (const message of parseIncomingCommunicationMessages(config, safePayload)) {
        await ingestCommunicationMessage({
          id: channel.id,
          provider: "vk",
          secretConfig: config.secretConfig
        }, message);
      }
    }
    await Promise.all([
      db.update(vkEventsLog).set({ status: "processed", errorMessage: null })
        .where(eq(vkEventsLog.id, logId)),
      db.update(vkIntegrations).set({
        lastEventAt: now,
        status: "connected",
        updatedAt: now
      }).where(eq(vkIntegrations.id, integration.id))
    ]);
    return plain("ok", 200, eventType, groupId);
  } catch (error) {
    const eventId = vkEventId(payload, rawBody);
    const message = error instanceof Error ? error.message : "VK event processing failed";
    try {
      await Promise.all([
        db.update(vkEventsLog).set({ status: "error", errorMessage: message.slice(0, 1000) })
          .where(and(
            eq(vkEventsLog.integrationId, integration.id),
            eq(vkEventsLog.eventId, eventId)
          )),
        db.update(vkIntegrations).set({ status: "error", updatedAt: now })
          .where(eq(vkIntegrations.id, integration.id))
      ]);
    } catch (persistenceError) {
      console.error("vk_callback_error_persistence_failed", {
        groupId,
        eventType,
        eventId,
        error: persistenceError
      });
    }
    console.error("vk_callback_processing_failed", { groupId, eventType, eventId, error });
    return plain("ok", 200, eventType, groupId);
  }
}
