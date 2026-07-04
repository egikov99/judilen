import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("public mobile navigation", () => {
  const header = source("src/components/site-header.tsx");
  const styles = source("src/app/globals.css");

  it("uses the same primary links on desktop and mobile", () => {
    for (const href of ["/", "/domiki", "/uslugi", "/otzyvy", "/kontakty"]) {
      expect(header).toContain(`href: "${href}"`);
    }
    expect(header).toContain('href="/login"');
    expect(header).toContain('href="/domiki"');
    expect(header).toContain("navigation.map");
  });

  it("has an accessible toggle and closes through links, backdrop, repeat click, and Escape", () => {
    expect(header).toContain('aria-expanded={isOpen}');
    expect(header).toContain('aria-controls="mobile-site-menu"');
    expect(header).toContain('isOpen ? "Закрыть меню" : "Открыть меню"');
    expect(header).toContain("setIsOpen((open) => !open)");
    expect(header).toContain('event.key === "Escape"');
    expect(header).toContain("onClick={() => closeMenu()}");
    expect(header).toContain("mobile-menu-scrim");
  });

  it("shows the burger only below the public navigation breakpoint", () => {
    expect(styles).toContain(".mobile-nav { display: none; }");
    expect(styles).toContain("@media (max-width: 950px)");
    expect(styles).toContain(".nav-actions { display: none; }");
    expect(styles).toContain(".mobile-nav { display: grid; }");
    expect(styles).toContain(".mobile-menu-panel.is-open");
    expect(styles).toContain("transition: opacity .2s ease, transform .2s ease");
  });
});
