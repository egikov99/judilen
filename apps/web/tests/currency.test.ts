import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

const files = [
  "src",
  "../../packages/db/src"
];

describe("currency copy", () => {
  it("does not use the Russian ruble sign in app source", () => {
    const output = execFileSync("rg", ["--files", ...files], { cwd: root, encoding: "utf8" });
    const contents = output.trim().split("\n").map((file) => readFileSync(join(root, file), "utf8")).join("\n");
    expect(contents).not.toContain("₽");
  });
});
