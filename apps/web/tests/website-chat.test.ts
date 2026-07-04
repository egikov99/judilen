import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("website chat", () => {
  it("persists visitor links, account ownership and read state", () => {
    const migration = source("../../packages/db/migrations/0017_website_chat.sql");
    expect(migration).toContain('ADD COLUMN "user_id"');
    expect(migration).toContain('ADD COLUMN "read_at"');
    expect(migration).toContain('CREATE TABLE "website_chat_visitors"');
    expect(migration).toContain('"website_chat_visitors_hash_unique"');
  });

  it("loads history, accepts repeated messages and limits abuse", () => {
    const route = source("src/app/api/public/contact-widget-chat/route.ts");
    expect(route).toContain("export async function GET");
    expect(route).toContain("export async function POST");
    expect(route).toContain("loadWebsiteMessages");
    expect(route).toContain("websiteChatRateLimited");
    expect(route).toContain(".max(4000)");
    expect(route).toContain('"X-Chat-Visitor"'.toLowerCase());
  });

  it("keeps the visitor token locally and polls for operator replies", () => {
    const component = source("src/components/website-chat.tsx");
    expect(component).toContain("judilen-chat-visitor");
    expect(component).toContain("localStorage");
    expect(component).toContain("setInterval");
    expect(component).toContain("4_000");
    expect(component).toContain("aria-live");
    expect(component).not.toContain("dangerouslySetInnerHTML");
  });

  it("uses the same chat in the public widget and customer account", () => {
    const widget = source("src/components/floating-contact-widget.tsx");
    const account = source("src/app/cabinet/trips/page.tsx");
    expect(widget).toContain("<WebsiteChat");
    expect(account).toContain("<WebsiteChat");
    expect(account).toContain('variant="account"');
  });

  it("allows CRM operators to reply through the website channel", () => {
    const replyRoute = source("src/app/api/admin/chats/[id]/messages/route.ts");
    const inboxComponent = source("src/components/admin/chat-inbox.tsx");
    const inboxServer = source("src/lib/communication-inbox.ts");
    expect(replyRoute).toContain('row.channel.provider === "website"');
    expect(replyRoute).toContain('direction: "outbound"');
    expect(replyRoute).not.toContain("Ответ через виджет пока недоступен");
    expect(inboxComponent).toContain("loadConversation(selectedId, true)");
    expect(inboxComponent).toContain("conversationStatusLabels");
    expect(inboxServer).toContain("Новое сообщение с сайта");
  });

  it("does not merge a visitor conversation owned by another account", () => {
    const resolver = source("src/lib/website-chat.ts");
    const logout = source("src/components/logout-button.tsx");
    expect(resolver).toContain("visitorBelongsToCurrentUser");
    expect(resolver).toContain("visitorConversation.userId === options.userId");
    expect(resolver).toContain("hashWebsiteVisitorToken");
    expect(logout).toContain('removeItem("judilen-chat-visitor")');
  });
});
