import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "@/lib/redaction";
import { safeJsonForHtml } from "@/lib/safe-json";
import { stripImageMetadata } from "@/lib/uploads";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? routeFiles(path) : name === "route.ts" ? [path] : [];
  });
}

describe("security hardening", () => {
  it("escapes script-breaking JSON-LD values", () => {
    const json = safeJsonForHtml({ name: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<script");
    expect(json).toContain("\\u003c/script\\u003e");
  });

  it("redacts credentials and personal identifiers from diagnostics", () => {
    const value = redactSensitiveText(
      "Authorization: Bearer abc123 password=hunter2 user@example.com smtp://user:secret@example.com"
    );
    expect(value).not.toContain("abc123");
    expect(value).not.toContain("hunter2");
    expect(value).not.toContain("user@example.com");
    expect(value).not.toContain(":secret@");
  });

  it("removes EXIF metadata from JPEG uploads", () => {
    const bytes = new Uint8Array([
      0xff, 0xd8,
      0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
      0xff, 0xdb, 0x00, 0x04, 0x00, 0x00,
      0xff, 0xda, 0x00, 0x02, 0x01, 0x02, 0xff, 0xd9
    ]);
    const stripped = stripImageMetadata(bytes, "jpg");
    expect(new TextDecoder().decode(stripped)).not.toContain("Exif");
    expect(stripped.length).toBeLessThan(bytes.length);
  });

  it("invalidates sessions on logout and password reset", () => {
    const logout = source("src/app/api/auth/logout/route.ts");
    const reset = source("src/app/api/auth/password-reset/confirm/route.ts");
    const request = source("src/app/api/auth/password-reset/request/route.ts");
    expect(logout).toContain("sessionVersion");
    expect(reset).toContain("sessionVersion");
    expect(reset).toContain("usedAt");
    expect(request).toContain("/reset-password#token=");
    expect(request).not.toContain("/reset-password?token=");
  });

  it("enforces owner checks and does not expose password hashes", () => {
    const payment = source("src/app/api/payments/route.ts");
    const paymentPage = source("src/app/oplata/[bookingId]/page.tsx");
    const paymentSuccessPage = source("src/app/oplata/[bookingId]/uspeh/page.tsx");
    const users = source("src/app/api/admin/users/route.ts");
    const updateUser = source("src/app/api/admin/users/[id]/route.ts");
    expect(payment).toContain("eq(customers.userId, session.userId)");
    expect(paymentPage).toContain("eq(customers.userId, session.userId)");
    expect(paymentSuccessPage).toContain("eq(customers.userId, session.userId)");
    expect(users).toContain("userResponse(user");
    expect(updateUser).toContain("userResponse(after");
    expect(users).not.toContain("item: { ...user");
    expect(updateUser).not.toContain("item: { ...after");
  });

  it("keeps every admin and account API behind server-side authorization", () => {
    for (const path of routeFiles(resolve(process.cwd(), "src/app/api/admin"))) {
      const route = readFileSync(path, "utf8");
      expect(route, path).toMatch(/require(?:Permission|AllPermissions)\(/);
    }
    for (const path of routeFiles(resolve(process.cwd(), "src/app/api/account"))) {
      expect(readFileSync(path, "utf8"), path).toContain("getSession()");
    }
  });

  it("protects state changes, private caches and security headers", () => {
    const proxy = source("src/proxy.ts");
    const config = source("next.config.ts");
    const login = source("src/components/login-form.tsx");
    expect(proxy).toContain("Недопустимый источник запроса");
    expect(proxy).toContain('"Cache-Control", "private, no-store"');
    expect(config).toContain("Content-Security-Policy");
    expect(config).toContain("Strict-Transport-Security");
    expect(config).toContain("frame-ancestors 'none'");
    expect(login).toContain('!requested.startsWith("//")');
    expect(login).toContain("new AbortController()");
    expect(login).toContain("finally");
    expect(login).toContain("setLoading(false)");
  });

  it("uses persistent rate limiting for sensitive endpoints", () => {
    const migration = source("../../packages/db/migrations/0018_security_hardening.sql");
    const login = source("src/app/api/auth/login/route.ts");
    const booking = source("src/app/api/bookings/route.ts");
    const webhook = source("src/app/api/webhooks/communications/[provider]/[secret]/route.ts");
    expect(migration).toContain('CREATE TABLE "security_rate_limits"');
    expect(login).toContain('scope: "auth.login"');
    expect(booking).toContain('scope: "booking.create"');
    expect(webhook).toContain("checkRateLimit");
  });

  it("does not send integration secrets to read-only staff", () => {
    const page = source("src/app/admin/integrations/page.tsx");
    const channels = source("src/app/api/admin/communication-channels/route.ts");
    const integrations = source("src/app/api/admin/integrations/route.ts");
    expect(page).toContain("canManageCalendars ? calendar.importUrl : null");
    expect(page).not.toContain("...calendar,");
    expect(channels).toContain("group && canReadChats");
    expect(integrations).not.toContain("items: await db.select().from(integrations)");
  });

  it("validates SMTP destinations and webhook signatures", () => {
    const smtp = source("src/lib/network-security.ts");
    const webhook = source("src/lib/communication-adapters.ts");
    const webhookUrl = source("src/lib/communication-channels.ts");
    expect(smtp).toContain("allowedSmtpPorts");
    expect(smtp).toContain("isPrivateOrReservedIp");
    expect(webhook).toContain("if (!channel.secretConfig.appSecret) return false");
    expect(webhook).toContain("return false");
    expect(webhookUrl).toContain("${row.id}");
    expect(webhookUrl).not.toContain("${row.webhookSecret}");
  });
});
