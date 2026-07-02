import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_TEMPLATE_VARIABLES } from "@/lib/email-templates";
import { onlinePaymentsEnabled } from "@/lib/payments";

describe("payment feature flag", () => {
  const initialValue = process.env.ONLINE_PAYMENTS_ENABLED;

  afterEach(() => {
    if (initialValue === undefined) delete process.env.ONLINE_PAYMENTS_ENABLED;
    else process.env.ONLINE_PAYMENTS_ENABLED = initialValue;
  });

  it("keeps online payments disabled by default", () => {
    delete process.env.ONLINE_PAYMENTS_ENABLED;
    expect(onlinePaymentsEnabled()).toBe(false);
  });

  it("enables the preserved online flow explicitly", () => {
    process.env.ONLINE_PAYMENTS_ENABLED = "true";
    expect(onlinePaymentsEnabled()).toBe(true);
  });
});

describe("email templates", () => {
  it("provides HTML and text fallbacks for every required event", () => {
    expect(Object.keys(DEFAULT_EMAIL_TEMPLATES)).toEqual(expect.arrayContaining([
      "booking_received", "booking_confirmed", "booking_cancelled", "password_reset",
      "arrival_reminder", "review_request", "booking_changed"
    ]));
    for (const template of Object.values(DEFAULT_EMAIL_TEMPLATES)) {
      expect(template.subject.length).toBeGreaterThan(0);
      expect(template.htmlContent.length).toBeGreaterThan(0);
      expect(template.textContent.length).toBeGreaterThan(0);
    }
  });

  it("exposes the documented template variables", () => {
    expect(EMAIL_TEMPLATE_VARIABLES).toContain("bookingNumber");
    expect(EMAIL_TEMPLATE_VARIABLES).toContain("resetPasswordUrl");
    expect(EMAIL_TEMPLATE_VARIABLES).toContain("reviewUrl");
  });

  it("creates durable email logs with a deduplication key", () => {
    const migrationPath = fileURLToPath(new URL(
      "../../../packages/db/migrations/0011_payments_email_reviews.sql",
      import.meta.url
    ));
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain('CREATE TABLE "email_logs"');
    expect(migration).toContain('CREATE UNIQUE INDEX "email_logs_dedupe_unique"');
  });
});
