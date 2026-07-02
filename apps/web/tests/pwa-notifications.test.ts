import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationEventTypes } from "@/lib/notification-types";

describe("admin PWA and notifications", () => {
  it("ships an admin-scoped standalone manifest with icons", () => {
    const manifest = readFileSync(resolve(process.cwd(), "src/app/manifest.ts"), "utf8");
    expect(manifest).toContain('start_url: "/admin"');
    expect(manifest).toContain('display: "standalone"');
    expect(manifest).toContain('src: "/icons/admin-192.png"');
    expect(manifest).toContain('src: "/icons/admin-512.png"');
    expect(manifest).not.toContain("/images/stitch/");
  });

  it("does not cache authenticated admin responses in the service worker", () => {
    const worker = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    expect(worker).toContain('addEventListener("push"');
    expect(worker).toContain('addEventListener("notificationclick"');
    expect(worker).not.toContain('addEventListener("fetch"');
    expect(worker).not.toContain("caches.open");
  });

  it("supports every required admin notification category", () => {
    expect(notificationEventTypes).toEqual([
      "booking_created",
      "customer_message",
      "customer_updated",
      "payment_status",
      "booking_cancelled",
      "arrival_reminder",
      "integration_error"
    ]);
  });

  it("deduplicates in-app notifications and delivery logs in the database", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "../../packages/db/migrations/0006_admin_notifications.sql"),
      "utf8"
    );
    expect(migration).toContain('"admin_notifications_user_dedupe_unique"');
    expect(migration).toContain('"notification_logs_user_dedupe_unique"');
    expect(migration).toContain('"push_subscriptions_endpoint_unique"');
  });

  it("protects push subscriptions with backend permissions", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/notifications/subscriptions/route.ts"),
      "utf8"
    );
    expect(route.match(/requirePermission\("dashboard\.read"\)/g)).toHaveLength(2);
    expect(route).toContain('return problem(401, "Требуется авторизация")');
    expect(route).toContain('return problem(403, "Недостаточно прав")');
  });

  it("excludes clients and keeps push payloads free of booking details", () => {
    const notifications = readFileSync(
      resolve(process.cwd(), "src/lib/admin-notifications.ts"),
      "utf8"
    );
    expect(notifications).toContain('ne(roles.name, "client")');
    expect(notifications).toContain('body: "Откройте админку, чтобы посмотреть подробности."');
    expect(notifications).not.toContain("guestName");
    expect(notifications).not.toContain("guestPhone");
    expect(notifications).not.toContain("guestEmail");
  });
});
