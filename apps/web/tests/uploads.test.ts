import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as serveUploadedImage } from "@/app/uploads/[...path]/route";
import { normalizeImageUrl } from "@/lib/image-urls";
import { saveImageFile, validateImageUpload } from "@/lib/uploads";

const samples = [
  { name: "photo.jpg", type: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0x00]) },
  { name: "photo.png", type: "image/png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) },
  { name: "photo.webp", type: "image/webp", bytes: new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]) }
];

describe("image uploads", () => {
  const originalUploadDir = process.env.UPLOAD_DIR;
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
  });

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

  it("normalizes historical filesystem and relative URLs", () => {
    expect(normalizeImageUrl("/app/apps/web/public/uploads/houses/house-id/photo.jpg")).toBe("/uploads/houses/house-id/photo.jpg");
    expect(normalizeImageUrl("public/uploads/services/shared/photo.webp")).toBe("/uploads/services/shared/photo.webp");
    expect(normalizeImageUrl("images/stitch/asset-021.png")).toBe("/images/stitch/asset-021.png");
    expect(normalizeImageUrl("")).toBeNull();
    expect(normalizeImageUrl("undefined")).toBeNull();
  });

  it("serves a newly uploaded image without restarting Next.js", async () => {
    const directory = mkdtempSync(resolve(tmpdir(), "judilen-uploads-"));
    temporaryDirectories.push(directory);
    process.env.UPLOAD_DIR = directory;

    const file = new File([samples[0].bytes], "photo.jpg", { type: "image/jpeg" });
    const saved = await saveImageFile(file, "houses", "house-id");
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const response = await serveUploadedImage(new Request(`http://localhost${saved.url}`), {
      params: Promise.resolve({ path: saved.url.split("/").slice(2) })
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(samples[0].bytes);
  });
});
