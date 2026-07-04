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

  it("uploads service files in one multipart request and supports deletion and ordering", () => {
    const manager = source("src/components/admin/service-images-manager.tsx");
    const upload = source("src/app/api/admin/services/[id]/images/route.ts");
    const deletion = source("src/app/api/admin/service-images/[id]/route.ts");
    const reorder = source("src/app/api/admin/services/[id]/images/reorder/route.ts");
    expect(manager).toContain("multiple");
    expect(manager).toContain("createEntityImageUploadForm");
    expect(manager).toContain('fetch(`/api/admin/services/${serviceId}/images`, { method: "POST", body: form })');
    expect(manager).toContain("onClick={() => void uploadSelected()}");
    expect(manager).toContain("disabled={busy || !selected.length}");
    expect(upload).toContain('form.getAll("files")');
    expect(upload).toContain('saveImageFile(file, "services", id)');
    expect(upload).toContain("Response.json({ items");
    expect(deletion).toContain("removeUploadedFile(before.url)");
    expect(reorder).toContain("imageIds");
    expect(reorder).not.toContain(".max(");
  });

  it("uploads house files in one multipart request without stale positions", () => {
    const manager = source("src/components/admin/house-images-manager.tsx");
    const upload = source("src/app/api/admin/houses/[id]/images/upload/route.ts");
    expect(manager).toContain("multiple");
    expect(manager).toContain("createEntityImageUploadForm");
    expect(manager).toContain("/api/admin/houses/${houseId}/images/upload");
    expect(manager).toContain("onClick={() => void uploadSelected()}");
    expect(manager).toContain("disabled={busy || !selected.length}");
    expect(upload).toContain('form.getAll("files")');
    expect(upload).toContain("pg_advisory_xact_lock");
    expect(upload).toContain("firstPosition");
    expect(upload).toContain("Response.json({ items");
  });

  it("does not silently require alt text before upload", () => {
    const managers = [
      source("src/components/admin/house-images-manager.tsx"),
      source("src/components/admin/service-images-manager.tsx")
    ].join("\n");
    expect(managers).not.toMatch(/if \(!selected\.length \|\| alt\.trim/);
    expect(managers).not.toMatch(/disabled=\{[^}]*alt\.trim/);
    expect(managers).toContain("alt-текст будет создан из имени файла");
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
    const gallery = source("src/components/image-gallery.tsx");
    const houseGallery = source("src/components/house-gallery.tsx");
    const styles = source("src/app/globals.css");
    const servicePage = source("src/app/uslugi/[slug]/page.tsx");
    expect(gallery).not.toContain("slice(0, 3)");
    expect(gallery).toContain("galleryImages.map(");
    expect(houseGallery).toContain("<ImageGallery");
    expect(styles).toContain(".house-image img { width: 100%; height: 100%; object-fit: cover;");
    expect(styles).toContain(".service-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover;");
    expect(styles).toContain(".image-gallery-main img { display: block; width: 100%; height: auto;");
    expect(styles).toContain("object-fit: contain;");
    expect(styles).toContain("max-width: 95vw");
    expect(styles).toContain("max-height: 90dvh");
    expect(servicePage).toContain("<ImageGallery");
  });

  it("provides thumbnails, fallback, swipe, and accessible lightbox controls", () => {
    const gallery = source("src/components/image-gallery.tsx");
    expect(gallery).toContain("fallbackImage");
    expect(gallery).toContain("image-gallery-thumbnails");
    expect(gallery).toContain("setSelectedIndex(index)");
    expect(gallery).toContain("onTouchStart");
    expect(gallery).toContain("onTouchEnd");
    expect(gallery).toContain('event.key === "Escape"');
    expect(gallery).toContain('event.key === "ArrowLeft"');
    expect(gallery).toContain('event.key === "ArrowRight"');
    expect(gallery).toContain("galleryImages.length > 1");
  });

  it("contains no three-image field or file-count limit in entity image code", () => {
    const sources = [
      source("src/components/admin/house-images-manager.tsx"),
      source("src/components/admin/service-images-manager.tsx"),
      source("src/components/house-gallery.tsx"),
      source("src/components/image-gallery.tsx"),
      source("src/app/api/admin/houses/[id]/images/route.ts"),
      source("src/app/api/admin/houses/[id]/images/upload/route.ts"),
      source("src/app/api/admin/services/[id]/images/route.ts")
    ].join("\n");
    expect(sources).not.toMatch(/maxFiles|MAX_IMAGES|limit:\s*3|image[123]|photo[123]/i);
  });
});
