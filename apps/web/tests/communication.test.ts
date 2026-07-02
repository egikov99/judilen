import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseIncomingCommunicationMessages,
  verifyCommunicationWebhook,
  type CommunicationChannelConfig
} from "@/lib/communication-adapters";
import { communicationProviders } from "@/lib/communication-types";

function channel(overrides: Partial<CommunicationChannelConfig> = {}): CommunicationChannelConfig {
  return {
    provider: "telegram",
    publicConfig: {},
    secretConfig: { botToken: "token" },
    webhookSecret: "webhook-secret",
    ...overrides
  };
}

describe("communication inbox", () => {
  it("defines every requested communication channel", () => {
    expect(communicationProviders).toEqual([
      "telegram",
      "telegram_group",
      "vk",
      "instagram",
      "whatsapp",
      "viber"
    ]);
  });

  it("normalizes Telegram private and group messages", () => {
    const privateMessage = parseIncomingCommunicationMessages(channel(), {
      update_id: 1,
      message: {
        message_id: 42,
        text: "Здравствуйте",
        chat: { id: 100, type: "private" },
        from: { id: 100, first_name: "Анна" }
      }
    });
    expect(privateMessage[0]).toMatchObject({
      externalChatId: "100",
      externalMessageId: "42",
      displayName: "Анна",
      isGroup: false,
      body: "Здравствуйте"
    });

    const groupMessage = parseIncomingCommunicationMessages(channel({
      provider: "telegram_group",
      publicConfig: { groupId: "-1009" }
    }), {
      message: {
        message_id: 7,
        text: "Уведомление платформы",
        chat: { id: -1009, type: "supergroup", title: "Бронирования" },
        from: { id: 15, first_name: "Bot" }
      }
    });
    expect(groupMessage[0]).toMatchObject({
      externalChatId: "-1009",
      displayName: "Бронирования",
      isGroup: true
    });
  });

  it("normalizes WhatsApp Cloud API messages", () => {
    const messages = parseIncomingCommunicationMessages(channel({
      provider: "whatsapp",
      publicConfig: { phoneNumberId: "1" },
      secretConfig: { accessToken: "token" }
    }), {
      entry: [{
        changes: [{
          value: {
            contacts: [{ wa_id: "375291234567", profile: { name: "Иван" } }],
            messages: [{ id: "wamid.1", from: "375291234567", type: "text", text: { body: "Свободно?" } }]
          }
        }]
      }]
    });
    expect(messages[0]).toMatchObject({
      externalChatId: "375291234567",
      externalMessageId: "wamid.1",
      displayName: "Иван",
      body: "Свободно?"
    });
  });

  it("rejects Telegram webhooks without the configured secret header", () => {
    expect(verifyCommunicationWebhook(channel(), "{}", new Headers(), {})).toBe(false);
    expect(verifyCommunicationWebhook(
      channel(),
      "{}",
      new Headers({ "x-telegram-bot-api-secret-token": "webhook-secret" }),
      {}
    )).toBe(true);
  });

  it("stores credentials encrypted and deduplicates external messages", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../packages/db/migrations/0007_communication_inbox.sql"),
      "utf8"
    );
    expect(migration).toContain('"secret_config_encrypted" text');
    expect(migration).toContain('"chat_conversations_channel_external_unique"');
    expect(migration).toContain('"chat_messages_conversation_external_unique"');
    expect(migration).toContain("('chats.read', 'Просмотр чатов')");

    const cipher = readFileSync(resolve(process.cwd(), "src/lib/credential-cipher.ts"), "utf8");
    expect(cipher).toContain('createCipheriv("aes-256-gcm"');
    expect(cipher).not.toContain("secretConfig: jsonb");
  });

  it("protects chat reads and writes with separate backend permissions", () => {
    const listRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/chats/route.ts"), "utf8");
    const sendRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/chats/[id]/messages/route.ts"), "utf8");
    expect(listRoute).toContain('requirePermission("chats.read")');
    expect(sendRoute).toContain('requirePermission("chats.write")');
    const inbox = readFileSync(resolve(process.cwd(), "src/lib/communication-inbox.ts"), "utf8");
    expect(inbox).toContain('userIdsWithPermission("chats.read")');
    const channels = readFileSync(resolve(process.cwd(), "src/app/api/admin/communication-channels/route.ts"), "utf8");
    expect(channels).toContain('requirePermission("integrations.update")');
    expect(channels).toContain("webhookUrl: canManage ?");
  });

  it("allows signed provider webhooks through the browser-origin guard", () => {
    const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    const webhook = readFileSync(
      resolve(process.cwd(), "src/app/api/webhooks/communications/[provider]/[secret]/route.ts"),
      "utf8"
    );
    expect(proxy).toContain('startsWith("/api/webhooks/communications/")');
    expect(webhook).toContain("verifyCommunicationWebhook");
    expect(webhook).toContain("communicationChannels.webhookSecret");
  });
});
