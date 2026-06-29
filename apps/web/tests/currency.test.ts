import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".sql"]);

const directories = [
  "src",
  "../../packages/db/src"
];

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectFiles(path);
    return sourceExtensions.has(path.slice(path.lastIndexOf("."))) ? [path] : [];
  });
}

describe("currency copy", () => {
  it("does not use the Russian ruble sign in app source", () => {
    const contents = directories
      .flatMap((directory) => collectFiles(join(root, directory)))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(contents).not.toContain("₽");
  });
});
