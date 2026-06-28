import { expect, test } from "@playwright/test";

test("homepage presents the booking journey", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Побег в сердце природы" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Забронировать" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Домики для тишины и близких" })).toBeVisible();
});

test("mobile layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.client + 1);
});
