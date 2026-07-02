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

export const runtime = "nodejs";

function plain(body: string, status = 200) {
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

export async function POST(request: Request) {
  const rawBody = await request.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return plain("invalid json", 400);
  }

  const groupId = text(payload.group_id);
  const eventType = text(payload.type);
  if (!groupId || !eventType) return plain("invalid event", 400);
  const safePayload = { ...payload };
  delete safePayload.secret;
  const [integration] = await db.select().from(vkIntegrations)
    .where(eq(vkIntegrations.groupId, groupId))
    .limit(1);
  if (!integration || integration.status === "not_configured") return plain("not found", 404);

  const now = new Date();
  if (eventType === "confirmation") {
    const confirmationToken = decryptVkSecret(integration.confirmationToken);
    if (!confirmationToken) return plain("confirmation token is not configured", 503);
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
    return plain(confirmationToken);
  }

  if (!integration.lastConfirmedAt || integration.status === "pending") {
    return plain("integration is not confirmed", 409);
  }
  if (!secureEquals(text(payload.secret), decryptVkSecret(integration.secretKey))) {
    return plain("forbidden", 403);
  }
  if (!vkEventTypes.has(eventType)) return plain("ok");

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
    if (!existingEvent || existingEvent.status !== "error") return plain("ok");
    logId = existingEvent.id;
    await db.update(vkEventsLog).set({ status: "processing", errorMessage: null })
      .where(eq(vkEventsLog.id, logId));
  }

  try {
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
    return plain("ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "VK event processing failed";
    await Promise.all([
      db.update(vkEventsLog).set({ status: "error", errorMessage: message.slice(0, 1000) })
        .where(eq(vkEventsLog.id, logId)),
      db.update(vkIntegrations).set({ status: "error", updatedAt: now })
        .where(eq(vkIntegrations.id, integration.id))
    ]);
    console.error("vk_callback_processing_failed", { groupId, eventType, eventId, error });
    return plain("error", 500);
  }
}
