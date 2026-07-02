import { createHmac, timingSafeEqual } from "node:crypto";
import type { CommunicationProvider } from "./communication-types";

export type CommunicationChannelConfig = {
  provider: CommunicationProvider;
  publicConfig: Record<string, string>;
  secretConfig: Record<string, string>;
  webhookSecret: string;
};

export type IncomingChannelMessage = {
  externalChatId: string;
  externalUserId: string | null;
  externalMessageId: string;
  displayName: string;
  avatarUrl: string | null;
  isGroup: boolean;
  senderName: string | null;
  body: string;
  attachments?: IncomingChannelAttachment[];
  rawPayload: Record<string, unknown>;
};

export type IncomingChannelAttachment = {
  externalFileId: string;
  kind: "image" | "file";
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  sourceUrl?: string;
};

const metaGraphVersion = process.env.META_GRAPH_VERSION ?? "v25.0";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || payload.ok === false || payload.error || (typeof payload.status === "number" && payload.status !== 0)) {
    const detail = text(record(payload.error).message) || text(payload.description) || text(payload.status_message) || `HTTP ${response.status}`;
    throw new Error(detail);
  }
  return payload;
}

function telegramUrl(token: string, method: string) {
  return `https://api.telegram.org/bot${token}/${method}`;
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function testCommunicationChannel(channel: CommunicationChannelConfig) {
  const { provider, publicConfig, secretConfig } = channel;
  if (provider === "telegram" || provider === "telegram_group") {
    const result = await requestJson(telegramUrl(secretConfig.botToken, "getMe"));
    const username = text(record(result.result).username) || "Telegram bot";
    if (provider === "telegram_group") {
      const group = await requestJson(telegramUrl(secretConfig.botToken, "getChat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: publicConfig.groupId })
      });
      return `${username} · ${text(record(group.result).title) || publicConfig.groupId}`;
    }
    return username;
  }
  if (provider === "vk") {
    const query = new URLSearchParams({
      group_id: publicConfig.groupId,
      access_token: secretConfig.accessToken,
      v: publicConfig.apiVersion || "5.199"
    });
    const result = await requestJson(`https://api.vk.com/method/groups.getById?${query}`);
    return text(record(list(result.response)[0]).name) || "VK community";
  }
  if (provider === "instagram") {
    const result = await requestJson(
      `https://graph.instagram.com/${metaGraphVersion}/${publicConfig.accountId}?fields=id,username`,
      { headers: bearer(secretConfig.accessToken) }
    );
    return text(result.username) || "Instagram";
  }
  if (provider === "whatsapp") {
    const result = await requestJson(
      `https://graph.facebook.com/${metaGraphVersion}/${publicConfig.phoneNumberId}?fields=display_phone_number,verified_name`,
      { headers: bearer(secretConfig.accessToken) }
    );
    return text(result.verified_name) || text(result.display_phone_number) || "WhatsApp";
  }
  const result = await requestJson("https://chatapi.viber.com/pa/get_account_info", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": secretConfig.authToken },
    body: "{}"
  });
  return text(result.name) || publicConfig.botName || "Viber";
}

export async function registerCommunicationWebhook(channel: CommunicationChannelConfig, webhookUrl: string) {
  if (channel.provider === "telegram" || channel.provider === "telegram_group") {
    await requestJson(telegramUrl(channel.secretConfig.botToken, "setWebhook"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: channel.webhookSecret,
        allowed_updates: ["message"]
      })
    });
  }
  if (channel.provider === "viber") {
    await requestJson("https://chatapi.viber.com/pa/set_webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": channel.secretConfig.authToken },
      body: JSON.stringify({ url: webhookUrl, event_types: ["message", "failed"], send_name: true, send_photo: true })
    });
  }
}

export async function disconnectCommunicationWebhook(channel: CommunicationChannelConfig) {
  if (channel.provider === "telegram" || channel.provider === "telegram_group") {
    await requestJson(telegramUrl(channel.secretConfig.botToken, "deleteWebhook"), { method: "POST" });
  }
  if (channel.provider === "viber") {
    await requestJson("https://chatapi.viber.com/pa/set_webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": channel.secretConfig.authToken },
      body: JSON.stringify({ url: "" })
    });
  }
}

export async function sendCommunicationMessage(channel: CommunicationChannelConfig, externalChatId: string, body: string) {
  const { provider, publicConfig, secretConfig } = channel;
  if (provider === "telegram" || provider === "telegram_group") {
    const result = await requestJson(telegramUrl(secretConfig.botToken, "sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: externalChatId, text: body })
    });
    return text(record(result.result).message_id);
  }
  if (provider === "vk") {
    const form = new URLSearchParams({
      peer_id: externalChatId,
      message: body,
      random_id: String(Date.now()),
      access_token: secretConfig.accessToken,
      v: publicConfig.apiVersion || "5.199"
    });
    const result = await requestJson("https://api.vk.com/method/messages.send", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    return text(result.response);
  }
  if (provider === "instagram") {
    const result = await requestJson(`https://graph.instagram.com/${metaGraphVersion}/${publicConfig.accountId}/messages`, {
      method: "POST",
      headers: bearer(secretConfig.accessToken),
      body: JSON.stringify({ recipient: { id: externalChatId }, message: { text: body } })
    });
    return text(result.message_id);
  }
  if (provider === "whatsapp") {
    const result = await requestJson(`https://graph.facebook.com/${metaGraphVersion}/${publicConfig.phoneNumberId}/messages`, {
      method: "POST",
      headers: bearer(secretConfig.accessToken),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: externalChatId,
        type: "text",
        text: { body }
      })
    });
    return text(record(list(result.messages)[0]).id);
  }
  const result = await requestJson("https://chatapi.viber.com/pa/send_message", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Viber-Auth-Token": secretConfig.authToken },
    body: JSON.stringify({
      receiver: externalChatId,
      type: "text",
      text: body,
      sender: { name: publicConfig.botName || "Юдилен" }
    })
  });
  return text(result.message_token);
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyCommunicationWebhook(
  channel: CommunicationChannelConfig,
  rawBody: string,
  headers: Headers,
  payload: Record<string, unknown>
) {
  if (channel.provider === "telegram" || channel.provider === "telegram_group") {
    return secureEquals(headers.get("x-telegram-bot-api-secret-token") ?? "", channel.webhookSecret);
  }
  if (channel.provider === "vk" && channel.secretConfig.callbackSecret) {
    return secureEquals(text(payload.secret), channel.secretConfig.callbackSecret);
  }
  if ((channel.provider === "instagram" || channel.provider === "whatsapp") && channel.secretConfig.appSecret) {
    const received = headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${createHmac("sha256", channel.secretConfig.appSecret).update(rawBody).digest("hex")}`;
    return secureEquals(received, expected);
  }
  if (channel.provider === "viber") {
    const received = headers.get("x-viber-content-signature") ?? "";
    const expected = createHmac("sha256", channel.secretConfig.authToken).update(rawBody).digest("hex");
    return secureEquals(received, expected);
  }
  return true;
}

function telegramMessages(channel: CommunicationChannelConfig, payload: Record<string, unknown>) {
  const message = record(payload.message);
  const chat = record(message.chat);
  const from = record(message.from);
  const chatId = text(chat.id);
  if (!chatId) return [];
  if (channel.provider === "telegram_group" && channel.publicConfig.groupId && channel.publicConfig.groupId !== chatId) return [];
  const isGroup = text(chat.type) !== "private";
  if (channel.provider === "telegram" && isGroup) return [];
  const senderName = [text(from.first_name), text(from.last_name)].filter(Boolean).join(" ") || text(from.username);
  const photo = list(message.photo)
    .map(record)
    .sort((left, right) => Number(left.file_size ?? 0) - Number(right.file_size ?? 0))
    .at(-1);
  const document = record(message.document);
  const attachments: IncomingChannelAttachment[] = [];
  if (photo?.file_id) {
    attachments.push({
      externalFileId: text(photo.file_id),
      kind: "image",
      fileName: `telegram-photo-${text(message.message_id)}.jpg`,
      mimeType: "image/jpeg",
      sizeBytes: Number(photo.file_size) || null
    });
  } else if (document.file_id) {
    const mimeType = text(document.mime_type) || "application/octet-stream";
    attachments.push({
      externalFileId: text(document.file_id),
      kind: mimeType.startsWith("image/") ? "image" : "file",
      fileName: text(document.file_name) || `telegram-document-${text(message.message_id)}`,
      mimeType,
      sizeBytes: Number(document.file_size) || null
    });
  }
  const body = text(message.text) || text(message.caption) || (attachments.length ? "" : "[Вложение]");
  return [{
    externalChatId: chatId,
    externalUserId: text(from.id) || null,
    externalMessageId: text(message.message_id),
    displayName: isGroup ? text(chat.title) || `Telegram ${chatId}` : senderName || `Telegram ${chatId}`,
    avatarUrl: null,
    isGroup,
    senderName: senderName || null,
    body,
    attachments,
    rawPayload: payload
  }];
}

function vkMessages(payload: Record<string, unknown>) {
  if (payload.type !== "message_new") return [];
  const message = record(record(payload.object).message);
  const peerId = text(message.peer_id);
  if (!peerId) return [];
  const attachments: IncomingChannelAttachment[] = [];
  for (const value of list(message.attachments)) {
    const attachment = record(value);
    const type = text(attachment.type);
    const entity = record(attachment[type]);
    if (type === "photo") {
      const size = list(entity.sizes)
        .map(record)
        .filter((item) => text(item.url))
        .sort((left, right) => (
          Number(left.width ?? 0) * Number(left.height ?? 0)
          - Number(right.width ?? 0) * Number(right.height ?? 0)
        ))
        .at(-1);
      if (size) {
        attachments.push({
          externalFileId: `photo${text(entity.owner_id)}_${text(entity.id)}_${text(entity.access_key)}`,
          kind: "image",
          fileName: `vk-photo-${text(entity.id) || text(message.id)}.jpg`,
          mimeType: "image/jpeg",
          sizeBytes: null,
          sourceUrl: text(size.url)
        });
      }
    } else if (type === "doc" && text(entity.url)) {
      const extension = text(entity.ext).toLowerCase();
      attachments.push({
        externalFileId: `doc${text(entity.owner_id)}_${text(entity.id)}_${text(entity.access_key)}`,
        kind: extension.match(/^(jpe?g|png|gif|webp)$/) ? "image" : "file",
        fileName: text(entity.title) || `vk-document-${text(entity.id)}${extension ? `.${extension}` : ""}`,
        mimeType: extension === "pdf" ? "application/pdf" : "application/octet-stream",
        sizeBytes: Number(entity.size) || null,
        sourceUrl: text(entity.url)
      });
    } else if (type === "audio" && text(entity.url)) {
      attachments.push({
        externalFileId: `audio${text(entity.owner_id)}_${text(entity.id)}`,
        kind: "file",
        fileName: `${text(entity.artist) || "VK"} - ${text(entity.title) || text(entity.id)}.mp3`,
        mimeType: "audio/mpeg",
        sizeBytes: null,
        sourceUrl: text(entity.url)
      });
    }
  }
  const body = text(message.text) || (attachments.length ? "" : "[Вложение]");
  return [{
    externalChatId: peerId,
    externalUserId: text(message.from_id) || null,
    externalMessageId: text(message.id) || text(message.conversation_message_id),
    displayName: `VK ${text(message.from_id) || peerId}`,
    avatarUrl: null,
    isGroup: Number(peerId) >= 2_000_000_000,
    senderName: null,
    body,
    attachments,
    rawPayload: payload
  }];
}

function instagramMessages(payload: Record<string, unknown>) {
  const messages: IncomingChannelMessage[] = [];
  for (const entryValue of list(payload.entry)) {
    for (const eventValue of list(record(entryValue).messaging)) {
      const event = record(eventValue);
      const message = record(event.message);
      const senderId = text(record(event.sender).id);
      if (!senderId || message.is_echo === true || (!message.text && !message.attachments)) continue;
      messages.push({
        externalChatId: senderId,
        externalUserId: senderId,
        externalMessageId: text(message.mid),
        displayName: `Instagram ${senderId}`,
        avatarUrl: null,
        isGroup: false,
        senderName: null,
        body: text(message.text) || "[Вложение]",
        rawPayload: payload
      });
    }
  }
  return messages;
}

function whatsappMessages(payload: Record<string, unknown>) {
  const messages: IncomingChannelMessage[] = [];
  for (const entryValue of list(payload.entry)) {
    for (const changeValue of list(record(entryValue).changes)) {
      const value = record(record(changeValue).value);
      const contacts = new Map(list(value.contacts).map((item) => {
        const contact = record(item);
        return [text(contact.wa_id), text(record(contact.profile).name)];
      }));
      for (const messageValue of list(value.messages)) {
        const message = record(messageValue);
        const from = text(message.from);
        if (!from) continue;
        messages.push({
          externalChatId: from,
          externalUserId: from,
          externalMessageId: text(message.id),
          displayName: contacts.get(from) || `WhatsApp ${from}`,
          avatarUrl: null,
          isGroup: false,
          senderName: contacts.get(from) || null,
          body: text(record(message.text).body) || `[${text(message.type) || "Вложение"}]`,
          rawPayload: payload
        });
      }
    }
  }
  return messages;
}

function viberMessages(payload: Record<string, unknown>) {
  if (payload.event !== "message") return [];
  const sender = record(payload.sender);
  const message = record(payload.message);
  const senderId = text(sender.id);
  if (!senderId) return [];
  return [{
    externalChatId: senderId,
    externalUserId: senderId,
    externalMessageId: text(payload.message_token),
    displayName: text(sender.name) || `Viber ${senderId}`,
    avatarUrl: text(sender.avatar) || null,
    isGroup: false,
    senderName: text(sender.name) || null,
    body: text(message.text) || `[${text(message.type) || "Вложение"}]`,
    rawPayload: payload
  }];
}

export function parseIncomingCommunicationMessages(
  channel: CommunicationChannelConfig,
  payload: Record<string, unknown>
): IncomingChannelMessage[] {
  if (channel.provider === "telegram" || channel.provider === "telegram_group") return telegramMessages(channel, payload);
  if (channel.provider === "vk") return vkMessages(payload);
  if (channel.provider === "instagram") return instagramMessages(payload);
  if (channel.provider === "whatsapp") return whatsappMessages(payload);
  return viberMessages(payload);
}
