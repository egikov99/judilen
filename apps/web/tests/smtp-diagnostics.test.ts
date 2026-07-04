import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { classifySmtpError } from "@/lib/smtp-diagnostics";

function smtpError(message: string, fields: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), fields);
}

describe("SMTP diagnostics", () => {
  it.each([
    [smtpError("getaddrinfo ENOTFOUND bad.smtp.local", { code: "ENOTFOUND" }), "dns", "ENOTFOUND"],
    [smtpError("connect ECONNREFUSED", { code: "ECONNREFUSED" }), "connection", "ECONNREFUSED"],
    [smtpError("Connection timed out", { code: "ETIMEDOUT" }), "connection", "ETIMEDOUT"],
    [smtpError("535 Authentication failed", { code: "EAUTH", responseCode: 535, response: "535 Authentication failed" }), "authentication", "EAUTH"],
    [smtpError("self signed certificate", { code: "ESOCKET" }), "tls", "ESOCKET"],
    [smtpError("certificate has expired", { code: "CERT_HAS_EXPIRED" }), "tls", "CERT_HAS_EXPIRED"]
  ])("classifies %s", (error, stage, code) => {
    const result = classifySmtpError(error);
    expect(result).toMatchObject({ success: false, stage, code });
    expect(result.description.length).toBeGreaterThan(10);
    expect(result.details).toContain(error.message);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("stack");
  });

  it("describes provider rejection during test delivery", () => {
    const result = classifySmtpError(smtpError("550 Sender rejected", { code: "EENVELOPE", response: "550 Sender rejected" }), "send");
    expect(result.stage).toBe("send");
    expect(result.details).toContain("550 Sender rejected");
    expect(result.description).toContain("не принял тестовое письмо");
  });

  it("runs DNS and transport verification and exposes structured API responses", () => {
    const email = readFileSync(resolve(process.cwd(), "src/lib/email.ts"), "utf8");
    const testRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/smtp-settings/test/route.ts"), "utf8");
    const saveRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/smtp-settings/route.ts"), "utf8");
    expect(email).toContain("await lookup(settings.host)");
    expect(email).toContain("await transport.verify()");
    expect(email).toContain("connectionTimeout");
    expect(email).toContain('status: "passed"');
    expect(testRoute).toContain("Response.json(diagnostic, { status: 503 })");
    expect(saveRoute).toContain("await diagnoseSmtpConnection()");
    expect(saveRoute).toContain("settingsSaved: true");
  });

  it("renders detailed error and success panels with copy action", () => {
    const component = readFileSync(resolve(process.cwd(), "src/components/admin/smtp-settings.tsx"), "utf8");
    expect(component).toContain("Скопировать ошибку");
    expect(component).toContain("Технические детали");
    expect(component).toContain("Рекомендации");
    expect(component).toContain("smtp-check-list");
    expect(component).toContain("Адрес для тестового письма");
    expect(component).toContain("navigator.clipboard.writeText");
  });
});
