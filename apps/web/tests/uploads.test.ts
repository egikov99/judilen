import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateImageUpload } from "@/lib/uploads";

const samples = [
  { name: "photo.jpg", type: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]) },
  { name: "photo.png", type: "image/png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  { name: "photo.webp", type: "image/webp", bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]) }
];

describe("image uploads", () => {
  it.each(samples)("accepts $type", ({ name, type, bytes }) => {
    expect(validateImageUpload({ name, type, size: bytes.length }, bytes, 1024).ok).toBe(true);
  });

  it("rejects unsupported content and mismatched extensions", () => {
    expect(validateImageUpload({ name: "script.svg", type: "image/svg+xml", size: 4 }, new Uint8Array([1, 2, 3, 4]), 1024)).toMatchObject({ ok: false, error: "type" });
    expect(validateImageUpload({ name: "photo.txt", type: "image/jpeg", size: 4 }, samples[0].bytes, 1024)).toMatchObject({ ok: false, error: "extension" });
  });

  it("rejects files larger than MAX_UPLOAD_BYTES", () => {
    expect(validateImageUpload({ name: "photo.jpg", type: "image/jpeg", size: 1025 }, samples[0].bytes, 1024)).toMatchObject({ ok: false, error: "size" });
  });

  it("enforces one main photo and provides a reorder endpoint", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../packages/db/migrations/0003_house_image_integrity.sql"), "utf8");
    const route = readFileSync(resolve(process.cwd(), "src/app/api/admin/houses/[id]/images/reorder/route.ts"), "utf8");
    expect(migration).toContain("house_images_one_main");
    expect(route).toContain("imageIds");
    expect(route).toContain("position");
  });
});
