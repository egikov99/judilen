import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("responsive admin sidebar layout", () => {
  const shell = source("src/components/admin/admin-shell.tsx");
  const styles = source("src/app/globals.css");

  it("keeps header, navigation, and user panel in document order", () => {
    const head = shell.indexOf('className="admin-sidebar-head"');
    const navigation = shell.indexOf('className="admin-nav"');
    const user = shell.indexOf('className="admin-user"');
    expect(head).toBeGreaterThan(-1);
    expect(navigation).toBeGreaterThan(head);
    expect(user).toBeGreaterThan(navigation);
  });

  it("uses a full-height flex column with only navigation scrolling", () => {
    expect(styles).toMatch(/\.admin-sidebar \{[^}]*display: flex;[^}]*height: 100dvh;[^}]*flex-direction: column;/);
    expect(styles).toMatch(/\.admin-nav \{[^}]*min-height: 0;[^}]*flex: 1 1 auto;[^}]*overflow-y: auto;/);
    expect(styles).toMatch(/\.admin-user \{[^}]*position: static;[^}]*flex: 0 0 auto;/);
    expect(styles).not.toMatch(/\.admin-user \{[^}]*position: absolute;/);
  });

  it("keeps the mobile drawer scrollable on short screens", () => {
    expect(styles).toContain("@media (max-width: 800px)");
    expect(styles).toContain(".admin-nav { max-height: none; padding-bottom: 10px; }");
    expect(styles).toContain("@media (max-height: 700px)");
    expect(styles).toContain(".admin-user .button { min-height: 40px; }");
  });
});
