import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_TAG_MANAGER_SETTINGS,
  TAG_MANAGER_CODE_LIMIT,
  tagManagerSettingsSchema
} from "@/lib/tag-manager-config";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("tag manager settings", () => {
  it("defaults to disabled and rejects oversized code", () => {
    expect(tagManagerSettingsSchema.parse({})).toEqual(DEFAULT_TAG_MANAGER_SETTINGS);
    expect(tagManagerSettingsSchema.safeParse({
      tagManagerEnabled: true,
      tagManagerHeadCode: "x".repeat(TAG_MANAGER_CODE_LIMIT + 1),
      tagManagerBodyCode: ""
    }).success).toBe(false);
  });

  it("stores tag manager settings in the global settings table with cache invalidation", () => {
    const server = source("src/lib/tag-manager.ts");
    expect(server).toContain('TAG_MANAGER_SETTINGS_KEY = "site.tag_manager"');
    expect(server).toContain("db, settings");
    expect(server).toContain("unstable_cache");
    expect(server).toContain('revalidateTag(TAG_MANAGER_CACHE_TAG, "max")');
    expect(server).toContain('revalidatePath("/", "layout")');
  });

  it("protects reads and writes with settings.manage and does not expose code publicly", () => {
    const adminRoute = source("src/app/api/admin/tag-manager/route.ts");
    expect(adminRoute.match(/requirePermission\("settings\.manage"\)/g)).toHaveLength(2);
    expect(adminRoute).toContain('"Cache-Control": "private, no-store"');
    expect(adminRoute).toContain("tagManagerSettingsSchema.safeParse");

    const publicThemeRoute = source("src/app/api/site-theme/route.ts");
    expect(publicThemeRoute).not.toContain("tagManagerHeadCode");
    expect(publicThemeRoute).not.toContain("tagManagerBodyCode");
  });

  it("injects code only through the public shell, not root, admin, cabinet or auth pages", () => {
    const publicShell = source("src/components/public-shell.tsx");
    expect(publicShell).toContain("TagManagerInjector");
    expect(publicShell).toContain("<TagManagerInjector />");

    for (const path of [
      "src/app/layout.tsx",
      "src/app/admin/layout.tsx",
      "src/app/cabinet/trips/page.tsx",
      "src/app/login/page.tsx",
      "src/app/register/page.tsx"
    ]) {
      expect(source(path)).not.toContain("TagManagerInjector");
    }
  });

  it("supports separate head and body snippets and documents raw HTML injection", () => {
    const injector = source("src/components/tag-manager-injector.tsx");
    expect(injector).toContain("tagManagerEnabled");
    expect(injector).toContain("tagManagerHeadCode.trim()");
    expect(injector).toContain("tagManagerBodyCode.trim()");
    expect(injector).toContain("dangerouslySetInnerHTML");
    expect(injector).toContain("administrator-provided analytics code");
  });

  it("provides admin controls for saving and clearing code", () => {
    const component = source("src/components/admin/tag-manager-settings.tsx");
    expect(component).toContain("Включить менеджер тегов");
    expect(component).toContain("Код в &lt;head&gt;");
    expect(component).toContain("Код после открытия &lt;body&gt;");
    expect(component).toContain("Очистить код");
    expect(component).toContain("Настройки менеджера тегов сохранены.");
    expect(component).toContain("Код менеджера тегов очищен.");
  });

  it("keeps CSP narrow while allowing standard GTM and GA domains", () => {
    const config = source("next.config.ts");
    expect(config).toContain("https://www.googletagmanager.com");
    expect(config).toContain("https://www.google-analytics.com");
    expect(config).toContain("https://region1.google-analytics.com");
    expect(config).not.toContain("script-src *");
  });
});
