import { expect, test } from "@playwright/test";

test("главная открывается и показывает APETIT", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("APETIT");
});
