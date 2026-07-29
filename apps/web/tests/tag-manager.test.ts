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
  const yandexMetrikaSnippet = `<!-- Yandex.Metrika counter -->
<script type="text/javascript">
    (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
    })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=111138129', 'ym');

    ym(111138129, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/111138129" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;

  it("defaults to disabled and rejects oversized code", () => {
    expect(tagManagerSettingsSchema.parse({})).toEqual(DEFAULT_TAG_MANAGER_SETTINGS);
    expect(tagManagerSettingsSchema.safeParse({
      tagManagerEnabled: true,
      tagManagerHeadCode: "x".repeat(TAG_MANAGER_CODE_LIMIT + 1),
      tagManagerBodyCode: ""
    }).success).toBe(false);
  });

  it("rejects structural markup and styles that can break the public layout", () => {
    for (const code of [
      "<head><script src='/analytics.js'></script></head>",
      "</body><script>track()</script>",
      "<style>body { display: none }</style>",
      "<section class='analytics'>visible content</section>",
      "<link rel='stylesheet' href='/analytics.css'>"
    ]) {
      expect(tagManagerSettingsSchema.safeParse({
        tagManagerEnabled: true,
        tagManagerHeadCode: code,
        tagManagerBodyCode: ""
      }).success).toBe(false);
    }
  });

  it("accepts the standard Yandex Metrika counter snippet", () => {
    const result = tagManagerSettingsSchema.safeParse({
      tagManagerEnabled: true,
      tagManagerHeadCode: yandexMetrikaSnippet,
      tagManagerBodyCode: ""
    });
    expect(result.success, result.success ? "" : JSON.stringify(result.error.issues)).toBe(true);
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

  it("injects separate head and body snippets without rendering structural wrappers", () => {
    const injector = source("src/components/tag-manager-injector.tsx");
    const runtime = source("src/components/tag-manager-runtime.tsx");
    expect(injector).toContain("tagManagerEnabled");
    expect(injector).toContain("tagManagerHeadCode.trim()");
    expect(injector).toContain("tagManagerBodyCode.trim()");
    expect(injector).toContain("TagManagerRuntime");
    expect(injector).not.toContain("dangerouslySetInnerHTML");
    expect(injector).not.toContain("<head");
    expect(runtime).toContain("document.head");
    expect(runtime).toContain("document.body");
    expect(runtime).toContain("return null");
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
    expect(config).toContain("https://mc.yandex.ru");
    expect(config).toContain("https://mc.yandex.com");
    expect(config).not.toContain("script-src *");
  });
});
