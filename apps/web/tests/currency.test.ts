import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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

  it("ships and connects the NBRB icon font", () => {
    for (const filename of ["nbrb.woff2", "nbrb.woff", "nbrb.ttf"]) {
      expect(existsSync(join(root, "public", "fonts", filename))).toBe(true);
    }
    const css = readFileSync(join(root, "src", "app", "globals.css"), "utf8");
    expect(css).toContain('font-family: "nbrb"');
    expect(css).toContain('url("/fonts/nbrb.woff2")');
    expect(css).toContain(".nbrb-icon");
  });
});
