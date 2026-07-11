import { mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  parseIncomingCommunicationMessages,
  verifyCommunicationWebhook,
  type CommunicationChannelConfig
} from "@/lib/communication-adapters";
import { communicationProviders } from "@/lib/communication-types";
import { downloadTelegramAttachment, downloadVkAttachment } from "@/lib/chat-attachment-storage";

function channel(overrides: Partial<CommunicationChannelConfig> = {}): CommunicationChannelConfig {
  return {
    provider: "telegram",
    publicConfig: {},
    secretConfig: { botToken: "token" },
    webhookSecret: "webhook-secret",
    ...overrides
  };
}

function vkChannel() {
  return channel({
    provider: "vk",
    publicConfig: { groupId: "229727757", apiVersion: "5.199" },
    secretConfig: { accessToken: "token" }
  });
}

function vkPayload(message: Record<string, unknown>) {
  return {
    type: "message_new",
    group_id: 229727757,
    event_id: "event-1",
    object: {
      message: {
        id: 55,
        peer_id: 123,
        from_id: 123,
        ...message
      }
    }
  };
}

const vkMarketAttachment = {
  type: "market",
  market: {
    owner_id: -123,
    id: 456,
    title: "Дом №10",
    description: "Комфортный дом",
    price: {
      text: "500–1 000 бел. руб."
    },
    thumb_photo: "https://sun9-1.vkuserphoto.ru/preview.jpg"
  }
};

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

  it("extracts Telegram photo and document metadata instead of a placeholder", () => {
    const photo = parseIncomingCommunicationMessages(channel(), {
      message: {
        message_id: 43,
        chat: { id: 100, type: "private" },
        from: { id: 100, first_name: "Анна" },
        photo: [
          { file_id: "small", file_size: 100 },
          { file_id: "large", file_size: 2000 }
        ]
      }
    })[0];
    expect(photo.body).toBe("");
    expect(photo.attachments).toEqual([expect.objectContaining({
      externalFileId: "large",
      kind: "image",
      mimeType: "image/jpeg",
      sizeBytes: 2000
    })]);

    const document = parseIncomingCommunicationMessages(channel(), {
      message: {
        message_id: 44,
        chat: { id: 100, type: "private" },
        from: { id: 100, first_name: "Анна" },
        document: {
          file_id: "document",
          file_name: "Правила.pdf",
          mime_type: "application/pdf",
          file_size: 4096
        }
      }
    })[0];
    expect(document.body).toBe("");
    expect(document.attachments?.[0]).toMatchObject({
      kind: "file",
      fileName: "Правила.pdf",
      mimeType: "application/pdf",
      sizeBytes: 4096
    });
  });

  it("downloads a Telegram image and validates its actual file signature", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "judilen-chat-"));
    const previousDirectory = process.env.CHAT_ATTACHMENT_DIR;
    process.env.CHAT_ATTACHMENT_DIR = directory;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        result: { file_path: "photos/file.jpg", file_size: 6 }
      }), { headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02])));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const stored = await downloadTelegramAttachment("token", "channel-id", {
        externalFileId: "file-id",
        kind: "image",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 6
      });
      expect(stored).toMatchObject({ kind: "image", mimeType: "image/jpeg", sizeBytes: 6 });
      expect(readFileSync(stored.storagePath)).toEqual(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]));
    } finally {
      vi.unstubAllGlobals();
      if (previousDirectory === undefined) delete process.env.CHAT_ATTACHMENT_DIR;
      else process.env.CHAT_ATTACHMENT_DIR = previousDirectory;
      await rm(directory, { recursive: true, force: true });
    }
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

  it("extracts VK photos and documents instead of a placeholder", () => {
    const messages = parseIncomingCommunicationMessages(vkChannel(), vkPayload({
      text: "",
      attachments: [
        {
          type: "photo",
          photo: {
            owner_id: 123,
            id: 7,
            sizes: [
              { width: 100, height: 100, url: "https://sun9-1.userapi.com/small.jpg" },
              { width: 1200, height: 800, url: "https://sun9-1.userapi.com/large.jpg" }
            ]
          }
        },
        {
          type: "doc",
          doc: {
            owner_id: 123,
            id: 8,
            title: "Правила.pdf",
            ext: "pdf",
            size: 4096,
            url: "https://vk.com/doc-file.pdf"
          }
        }
      ]
    }));
    expect(messages[0].body).toBe("");
    expect(messages[0].attachments).toEqual([
      expect.objectContaining({
        kind: "image",
        sourceUrl: "https://sun9-1.userapi.com/large.jpg"
      }),
      expect.objectContaining({
        kind: "file",
        fileName: "Правила.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096
      })
    ]);
  });

  it("extracts VK market cards with text and structured metadata", () => {
    const messages = parseIncomingCommunicationMessages(vkChannel(), vkPayload({
      text: "Здравствуйте!\nМеня заинтересовала эта услуга.",
      attachments: [vkMarketAttachment]
    }));
    expect(messages[0].body).toBe("Здравствуйте!\nМеня заинтересовала эта услуга.");
    expect(messages[0].attachments?.[0]).toMatchObject({
      externalFileId: "market-123_456",
      kind: "market",
      title: "Дом №10",
      description: "Комфортный дом",
      previewUrl: "https://sun9-1.vkuserphoto.ru/preview.jpg",
      externalUrl: "https://vk.com/market-123?w=product-123_456",
      metadata: expect.objectContaining({
        ownerId: "-123",
        id: "456",
        priceText: "500–1 000 бел. руб.",
        thumbPhoto: "https://sun9-1.vkuserphoto.ru/preview.jpg"
      })
    });
  });

  it("keeps VK market-only messages as attachment messages", () => {
    const messages = parseIncomingCommunicationMessages(vkChannel(), vkPayload({
      text: "",
      attachments: [vkMarketAttachment]
    }));
    expect(messages[0].body).toBe("");
    expect(messages[0].attachments?.[0]?.kind).toBe("market");
  });

  it("accepts VK market cards without preview or price", () => {
    const messages = parseIncomingCommunicationMessages(vkChannel(), vkPayload({
      text: "Интересно",
      attachments: [{
        type: "market",
        market: {
          owner_id: -123,
          id: 457,
          title: "Дом без цены",
          description: "Описание без картинки"
        }
      }]
    }));
    expect(messages[0].attachments?.[0]).toMatchObject({
      kind: "market",
      title: "Дом без цены",
      description: "Описание без картинки",
      externalUrl: "https://vk.com/market-123?w=product-123_457"
    });
    expect(messages[0].attachments?.[0]?.previewUrl).toBe("");
    expect(messages[0].attachments?.[0]?.metadata).toMatchObject({ priceText: null });
  });

  it("keeps VK photo and market attachments in the same message", () => {
    const messages = parseIncomingCommunicationMessages(vkChannel(), vkPayload({
      text: "",
      attachments: [
        {
          type: "photo",
          photo: {
            owner_id: 123,
            id: 7,
            sizes: [{ width: 1200, height: 800, url: "https://sun9-1.userapi.com/large.jpg" }]
          }
        },
        vkMarketAttachment
      ]
    }));
    expect(messages[0].attachments).toEqual([
      expect.objectContaining({ kind: "image", sourceUrl: "https://sun9-1.userapi.com/large.jpg" }),
      expect.objectContaining({ kind: "market", externalFileId: "market-123_456" })
    ]);
  });

  it("downloads VK attachments only from trusted HTTPS hosts", async () => {
    await expect(downloadVkAttachment("channel-id", {
      externalFileId: "photo1",
      kind: "image",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      sizeBytes: null,
      sourceUrl: "https://example.com/photo.jpg"
    })).rejects.toThrow("not allowed");
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

    const attachmentMigration = readFileSync(
      resolve(process.cwd(), "../../packages/db/migrations/0008_chat_attachments.sql"),
      "utf8"
    );
    expect(attachmentMigration).toContain('"chat_attachments_message_external_unique"');
    expect(attachmentMigration).toContain('"storage_path" text NOT NULL');

    const marketAttachmentMigration = readFileSync(
      resolve(process.cwd(), "../../packages/db/migrations/0021_chat_market_attachments.sql"),
      "utf8"
    );
    expect(marketAttachmentMigration).toContain('ADD COLUMN "metadata" jsonb');
    expect(marketAttachmentMigration).toContain('DROP NOT NULL');
    expect(marketAttachmentMigration).toContain("('image', 'file', 'market')");

    const vkMigration = readFileSync(
      resolve(process.cwd(), "../../packages/db/migrations/0009_vk_callback.sql"),
      "utf8"
    );
    expect(vkMigration).toContain('CREATE TABLE "vk_integrations"');
    expect(vkMigration).toContain('"vk_events_log_event_unique"');
    expect(vkMigration).toContain('"confirmation_token" text NOT NULL');

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
    const attachmentRoute = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/chat-attachments/[id]/route.ts"),
      "utf8"
    );
    expect(attachmentRoute).toContain('requirePermission("chats.read")');
    expect(attachmentRoute).toContain('"Cache-Control": "private, no-store"');
    expect(attachmentRoute).toContain('attachment.kind !== "image" && attachment.kind !== "file"');
  });

  it("keeps market attachments durable through inbox storage, API and UI contracts", () => {
    const inbox = readFileSync(resolve(process.cwd(), "src/lib/communication-inbox.ts"), "utf8");
    expect(inbox).toContain('attachment.kind === "market"');
    expect(inbox).toContain("storagePath: null");
    expect(inbox).toContain(".onConflictDoNothing()");
    expect(inbox).not.toContain("Boolean(existingAttachment)");

    const chatRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/chats/[id]/route.ts"), "utf8");
    expect(chatRoute).toContain("title: attachment.title");
    expect(chatRoute).toContain("previewUrl: attachment.previewUrl");
    expect(chatRoute).toContain("metadata: attachment.metadata");
    expect(chatRoute).toContain('attachment.kind === "image" || attachment.kind === "file"');

    const inboxComponent = readFileSync(resolve(process.cwd(), "src/components/admin/chat-inbox.tsx"), "utf8");
    expect(inboxComponent).toContain('kind: "image" | "file" | "market"');
    expect(inboxComponent).toContain('attachment.kind === "market"');
    expect(inboxComponent).toContain("chat-market-card");
    expect(inboxComponent).toContain("Открыть в VK");
    expect(inboxComponent).toContain("setLightbox(attachment)");

    const styles = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(styles).toContain(".chat-market-card");
    expect(styles).toContain(".chat-market-preview");
    expect(styles).toContain("-webkit-line-clamp: 3");
  });

  it("allows signed provider webhooks through the browser-origin guard", () => {
    const proxy = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
    const webhook = readFileSync(
      resolve(process.cwd(), "src/app/api/webhooks/communications/[provider]/[secret]/route.ts"),
      "utf8"
    );
    expect(proxy).toContain('startsWith("/api/webhooks/communications/")');
    expect(webhook).toContain("verifyCommunicationWebhook");
    expect(webhook).toContain("eq(communicationChannels.id, secret)");
    expect(webhook).not.toContain("eq(communicationChannels.webhookSecret, secret)");

    const vkCallback = readFileSync(
      resolve(process.cwd(), "src/app/api/integrations/vk/callback/route.ts"),
      "utf8"
    );
    expect(proxy).toContain('pathname === "/api/integrations/vk/callback"');
    expect(vkCallback).toContain('eventType === "confirmation"');
    expect(vkCallback).toContain("process.env.VK_CONFIRMATION_TOKEN");
    expect(vkCallback).toContain("return plain(configuredConfirmationToken, 200");
    expect(vkCallback).toContain('"Content-Type": "text/plain; charset=utf-8"');
    expect(vkCallback).toContain('console.info("vk_callback_response"');
    expect(vkCallback).toContain("secureEquals(text(payload.secret)");
    expect(vkCallback).toContain("delete safePayload.secret");
    expect(vkCallback).toContain("vkEventsLog.eventId");

    const compose = readFileSync(resolve(process.cwd(), "../../docker-compose.yml"), "utf8");
    expect(compose).toContain("VK_GROUP_ID: ${VK_GROUP_ID:-}");
    expect(compose).toContain("VK_CONFIRMATION_TOKEN: ${VK_CONFIRMATION_TOKEN:-}");
    expect(compose).not.toContain("a7ef0db2");
  });
});
