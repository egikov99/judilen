import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildContactChannelUrl,
  contactWidgetChannelTypes,
  contactWidgetSettingsSchema
} from "@/lib/contact-widget";

const channel = (channelType: typeof contactWidgetChannelTypes[number]) => ({
  channelType,
  enabled: false,
  displayName: channelType,
  subtitle: "",
  url: "",
  phone: "",
  username: "",
  defaultMessage: "",
  sortOrder: contactWidgetChannelTypes.indexOf(channelType) * 10,
  icon: channelType
});

describe("contact widget settings", () => {
  it("builds safe links for supported external channels", () => {
    expect(buildContactChannelUrl({ ...channel("telegram"), username: "@judilen" })).toBe("https://t.me/judilen");
    expect(buildContactChannelUrl({ ...channel("whatsapp"), phone: "+375 29 123-45-67", defaultMessage: "Здравствуйте" }))
      .toBe("https://wa.me/375291234567?text=%D0%97%D0%B4%D1%80%D0%B0%D0%B2%D1%81%D1%82%D0%B2%D1%83%D0%B9%D1%82%D0%B5");
    expect(buildContactChannelUrl({ ...channel("instagram"), username: "judilen.by" })).toBe("https://instagram.com/judilen.by");
  });

  it("rejects an enabled channel without required settings", () => {
    const channels = contactWidgetChannelTypes.map(channel);
    channels[0] = { ...channels[0], enabled: true };
    expect(contactWidgetSettingsSchema.safeParse({ channels }).success).toBe(false);
  });

  it("does not expose website chat without a greeting", () => {
    expect(buildContactChannelUrl({ ...channel("website"), enabled: true })).toBeNull();
  });

  it("creates the website CRM channel in the migration", () => {
    const path = fileURLToPath(new URL(
      "../../../packages/db/migrations/0012_contact_widget.sql",
      import.meta.url
    ));
    const migration = readFileSync(path, "utf8");
    expect(migration).toContain('CREATE TABLE "contact_widget_settings"');
    expect(migration).toContain("('website', 'Чат на сайте', true, 'connected'");
    const droppedConstraint = migration.indexOf('DROP CONSTRAINT IF EXISTS "communication_channels_provider_check"');
    const websiteChannel = migration.indexOf('INSERT INTO "communication_channels"');
    const updatedConstraint = migration.indexOf('CHECK ("provider" IN');
    expect(droppedConstraint).toBeGreaterThan(-1);
    expect(websiteChannel).toBeGreaterThan(droppedConstraint);
    expect(updatedConstraint).toBeGreaterThan(websiteChannel);
    expect(migration.slice(updatedConstraint)).toContain("'website'");
  });
});
