import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adminNavigation, can } from "@judilen/auth";

describe("gazebos section", () => {
  it("adds production-safe database objects and permissions", () => {
    const migration = readFileSync(resolve(process.cwd(), "../../packages/db/migrations/0022_gazebos_service_rental_fields.sql"), "utf8");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "min_rental_hours"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "extension_price"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "gazebos"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS "gazebo_images"');
    expect(migration).toContain("'gazebos.read'");
  });

  it("exposes gazebo admin navigation to content roles", () => {
    expect(can("content_manager", "gazebos.update")).toBe(true);
    expect(can("content_manager", "gazebos.delete")).toBe(false);
    expect(adminNavigation("content_manager").map((item) => item.href)).toContain("/admin/gazebos");
  });

  it("has CRUD, image upload, deletion, publication and reorder endpoints", () => {
    const createRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/gazebos/route.ts"), "utf8");
    const itemRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/gazebos/[id]/route.ts"), "utf8");
    const imagesRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/gazebos/[id]/images/route.ts"), "utf8");
    const imageRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/gazebo-images/[id]/route.ts"), "utf8");
    const reorderRoute = readFileSync(resolve(process.cwd(), "src/app/api/admin/gazebos/[id]/images/reorder/route.ts"), "utf8");
    const manager = readFileSync(resolve(process.cwd(), "src/components/admin/gazebo-manager.tsx"), "utf8");
    expect(createRoute).toContain('requirePermission("gazebos.create")');
    expect(itemRoute).toContain('requirePermission("gazebos.update")');
    expect(itemRoute).toContain('requirePermission("gazebos.delete")');
    expect(createRoute).toContain("gazeboSchema");
    expect(manager).toContain("isPublished");
    expect(imagesRoute).toContain('saveImageFile(file, "gazebos", id)');
    expect(imageRoute).toContain("removeUploadedFile");
    expect(reorderRoute).toContain("imageIds");
  });

  it("filters unpublished gazebos from public data and pages", () => {
    const loader = readFileSync(resolve(process.cwd(), "src/lib/gazebos.ts"), "utf8");
    const listPage = readFileSync(resolve(process.cwd(), "src/app/besedki/page.tsx"), "utf8");
    const detailPage = readFileSync(resolve(process.cwd(), "src/app/besedki/[slug]/page.tsx"), "utf8");
    expect(loader).toContain("eq(gazebos.isPublished, true)");
    expect(listPage).toContain("getPublicGazebos");
    expect(detailPage).toContain("getPublicGazeboBySlug");
    expect(detailPage).not.toContain("HouseBookingCard");
    expect(detailPage).not.toContain("formatCurrency");
  });
});
