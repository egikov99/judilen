import "server-only";

import { createHash } from "node:crypto";
import { decryptCredentials, encryptCredentials } from "./credential-cipher";

export const vkEventTypes = new Set([
  "message_new",
  "message_reply",
  "message_edit",
  "message_allow",
  "message_deny",
  "photo_new",
  "wall_post_new",
  "group_join",
  "group_leave"
]);

export function vkCallbackUrl() {
  const origin = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")
    .replace(/\/+$/, "");
  return `${origin}/api/integrations/vk/callback`;
}

export function isPublicHttpsCallback(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && parsed.hostname !== "localhost"
      && parsed.hostname !== "127.0.0.1"
      && !parsed.hostname.endsWith(".local");
  } catch {
    return false;
  }
}

export function encryptVkSecret(value: string) {
  return encryptCredentials({ value });
}

export function decryptVkSecret(value: string) {
  return decryptCredentials(value).value ?? "";
}

export function vkEventId(payload: Record<string, unknown>, rawBody: string) {
  if (typeof payload.event_id === "string" && payload.event_id) return payload.event_id;
  const object = typeof payload.object === "object" && payload.object ? payload.object as Record<string, unknown> : {};
  const message = typeof object.message === "object" && object.message
    ? object.message as Record<string, unknown>
    : {};
  const messageId = message.id ?? message.conversation_message_id;
  if (messageId !== undefined) return `${String(payload.type)}:${String(payload.group_id)}:${String(messageId)}`;
  return createHash("sha256").update(rawBody).digest("hex");
}
