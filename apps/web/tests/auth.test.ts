import { describe, expect, it } from "vitest";
import { adminNavigation, can, createSessionToken, verifySessionToken } from "@judilen/auth";
import { removesLastSuperAdmin } from "@/lib/user-access-rules";

describe("RBAC", () => {
  it("does not expose finance and integration sections to a content manager", () => {
    expect(can("content_manager", "houses.write")).toBe(true);
    expect(can("content_manager", "services.update")).toBe(true);
    expect(can("content_manager", "gazebos.update")).toBe(true);
    expect(can("content_manager", "reviews.update")).toBe(true);
    expect(can("content_manager", "users.manage")).toBe(false);
    expect(can("content_manager", "reports.read")).toBe(false);
    expect(can("content_manager", "integrations.manage")).toBe(false);
    expect(can("content_manager", "external_calendars.read")).toBe(false);
    expect(can("content_manager", "external_calendars.sync")).toBe(false);
    expect(can("content_manager", "calendar_conflicts.update")).toBe(false);
    expect(can("content_manager", "uploads.create")).toBe(true);
    expect(can("admin", "external_calendars.create")).toBe(true);
    expect(can("admin", "calendar_conflicts.update")).toBe(true);
    expect(adminNavigation("content_manager").map((item) => item.href)).toEqual(["/admin", "/admin/houses", "/admin/services", "/admin/gazebos", "/admin/reviews", "/admin/content"]);
  });

  it("round-trips a signed session", async () => {
    const secret = "test-secret-that-is-at-least-32-characters";
    const session = { userId: "user-1", email: "a@example.com", name: "Анна", role: "manager" as const, sessionVersion: 0 };
    const token = await createSessionToken(session, secret);
    await expect(verifySessionToken(token, secret)).resolves.toMatchObject(session);
    await expect(verifySessionToken(`${token}x`, secret)).resolves.toBeNull();
  });

  it("enforces staff role boundaries", () => {
    expect(can("super_admin", "users.delete")).toBe(true);
    expect(can("admin", "users.read")).toBe(false);
    expect(can("manager", "bookings.update")).toBe(true);
    expect(can("manager", "houses.update")).toBe(false);
    expect(can("viewer", "bookings.read")).toBe(true);
    expect(can("viewer", "bookings.update")).toBe(false);
    expect(can("viewer", "services.update")).toBe(false);
  });

  it("does not allow removing the last active Super Admin", () => {
    expect(removesLastSuperAdmin({ currentRole: "super_admin", currentActive: true, nextRole: "admin", activeSuperAdmins: 1 })).toBe(true);
    expect(removesLastSuperAdmin({ currentRole: "super_admin", currentActive: true, nextActive: false, activeSuperAdmins: 2 })).toBe(false);
    expect(removesLastSuperAdmin({ currentRole: "admin", currentActive: true, nextActive: false, activeSuperAdmins: 1 })).toBe(false);
  });
});
