import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("house and service image galleries", () => {
  it("migrates the legacy service image into an unlimited related table", () => {
    const migration = source("../../packages/db/migrations/0016_service_images.sql");
    expect(migration).toContain('CREATE TABLE "service_images"');
    expect(migration).toContain('SELECT "id", "image_url", "title", 0');
    expect(migration).toContain('DROP COLUMN "image_url"');
    expect(migration).not.toContain("LIMIT 3");
  });

  it("supports multiple uploads, individual deletion, and ordering for services", () => {
    const manager = source("src/components/admin/service-images-manager.tsx");
    const upload = source("src/app/api/admin/services/[id]/images/route.ts");
    const deletion = source("src/app/api/admin/service-images/[id]/route.ts");
    const reorder = source("src/app/api/admin/services/[id]/images/reorder/route.ts");
    expect(manager).toContain("multiple");
    expect(manager).toContain("selected.entries()");
    expect(upload).toContain('saveImageFile(file, "services", id)');
    expect(deletion).toContain("removeUploadedFile(before.url)");
    expect(reorder).toContain("imageIds");
    expect(reorder).not.toContain(".max(");
  });

  it("supports multiple sequential house uploads without stale positions", () => {
    const manager = source("src/components/admin/house-images-manager.tsx");
    const upload = source("src/app/api/admin/uploads/route.ts");
    expect(manager).toContain("multiple");
    expect(manager).toContain("selected.entries()");
    expect(upload).toContain("pg_advisory_xact_lock");
    expect(upload).toContain("(last?.position ?? -1) + 1");
  });

  it("returns image arrays from house and service APIs", () => {
    const houseList = source("src/app/api/admin/houses/route.ts");
    const houseDetail = source("src/app/api/admin/houses/[id]/route.ts");
    const serviceList = source("src/app/api/admin/services/route.ts");
    const serviceDetail = source("src/app/api/admin/services/[id]/route.ts");
    const publicServices = source("src/lib/services.ts");
    expect(houseList).toContain("images");
    expect(houseDetail).toContain("images");
    expect(serviceList).toContain("images:");
    expect(serviceDetail).toContain("images");
    expect(publicServices).toContain("service.images.push");
  });

  it("keeps cover crop only in cards and preserves proportions in detail galleries", () => {
    const gallery = source("src/components/house-gallery.tsx");
    const styles = source("src/app/globals.css");
    const servicePage = source("src/app/uslugi/[slug]/page.tsx");
    expect(gallery).not.toContain("slice(0, 3)");
    expect(gallery).toContain("images.map(");
    expect(styles).toContain(".house-image img { width: 100%; height: 100%; object-fit: cover;");
    expect(styles).toContain(".service-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover;");
    expect(styles).toContain(".detail-image-gallery-item img { display: block; width: 100%; height: auto; object-fit: contain;");
    expect(styles).toContain("max-width: 90vw");
    expect(styles).toContain("max-height: 90dvh");
    expect(servicePage).toContain("<DetailImageGallery");
  });

  it("contains no three-image field or file-count limit in entity image code", () => {
    const sources = [
      source("src/components/admin/house-images-manager.tsx"),
      source("src/components/admin/service-images-manager.tsx"),
      source("src/components/house-gallery.tsx"),
      source("src/app/api/admin/houses/[id]/images/route.ts"),
      source("src/app/api/admin/services/[id]/images/route.ts")
    ].join("\n");
    expect(sources).not.toMatch(/maxFiles|MAX_IMAGES|limit:\s*3|image[123]|photo[123]/i);
  });
});
