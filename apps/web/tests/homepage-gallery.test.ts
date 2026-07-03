import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("homepage territory gallery", () => {
  it("stores ordered gallery images in a dedicated table", () => {
    const migration = source("../../packages/db/migrations/0014_homepage_gallery.sql");
    expect(migration).toContain('CREATE TABLE "homepage_gallery_images"');
    expect(migration).toContain('"section_key"');
    expect(migration).toContain('"image_url"');
    expect(migration).toContain('"sort_order"');
    expect(migration).toContain("homepage_gallery_section_order_unique");
  });

  it("supports upload, individual deletion, and unlimited reordering", () => {
    const uploadRoute = source("src/app/api/admin/homepage-gallery/route.ts");
    const deleteRoute = source("src/app/api/admin/homepage-gallery/[id]/route.ts");
    const reorderRoute = source("src/app/api/admin/homepage-gallery/reorder/route.ts");
    expect(uploadRoute).toContain('saveImageFile(file, "content", sectionKey)');
    expect(deleteRoute).toContain("removeUploadedFile(before.imageUrl)");
    expect(deleteRoute).toContain("sortOrder: index");
    expect(reorderRoute).toContain("imageIds");
    expect(reorderRoute).not.toContain(".max(");
  });

  it("replaces the static image while preserving fallback and lightbox controls", () => {
    const page = source("src/app/page.tsx");
    const gallery = source("src/components/territory-gallery.tsx");
    const styles = source("src/app/globals.css");
    expect(page).toContain("<TerritoryGallery");
    expect(page).toContain("TERRITORY_GALLERY_FALLBACK");
    expect(page).not.toContain('<div className="split-image" role="img"');
    expect(gallery).toContain('event.key === "Escape"');
    expect(gallery).toContain('event.key === "ArrowLeft"');
    expect(gallery).toContain("event.target === event.currentTarget");
    expect(gallery).toContain("Следующее фото");
    expect(styles).toContain(".territory-gallery-main img { object-fit: cover;");
  });
});
