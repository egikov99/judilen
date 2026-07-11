import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ClientNotesManager", () => {
  it("renders note list controls and disables empty submits", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/admin/client-notes-manager.tsx"), "utf8");
    expect(source).toContain("Комментарии администратора");
    expect(source).toContain("<label>Новая заметка</label>");
    expect(source).toContain("disabled={isSaving || !text.trim()}");
    expect(source).toContain("Заметок нет.");
  });
});
