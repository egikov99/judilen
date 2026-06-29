import { describe, expect, it } from "vitest";
import { adminNavigation, can, createSessionToken, verifySessionToken } from "@judilen/auth";

describe("RBAC", () => {
  it("does not expose finance and integration sections to a content manager", () => {
    expect(can("content_manager", "houses.write")).toBe(true);
    expect(can("content_manager", "services.update")).toBe(true);
    expect(can("content_manager", "reviews.update")).toBe(true);
    expect(can("content_manager", "users.manage")).toBe(false);
    expect(can("content_manager", "reports.read")).toBe(false);
    expect(can("content_manager", "integrations.manage")).toBe(false);
    expect(adminNavigation("content_manager").map((item) => item.href)).toEqual(["/admin", "/admin/houses", "/admin/services", "/admin/reviews", "/admin/content"]);
  });

  it("round-trips a signed session", async () => {
    const secret = "test-secret-that-is-at-least-32-characters";
    const session = { userId: "user-1", email: "a@example.com", name: "Анна", role: "manager" as const };
    const token = await createSessionToken(session, secret);
    await expect(verifySessionToken(token, secret)).resolves.toMatchObject(session);
    await expect(verifySessionToken(`${token}x`, secret)).resolves.toBeNull();
  });
});
