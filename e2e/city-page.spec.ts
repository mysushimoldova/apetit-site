import { expect, test } from "@playwright/test";

test("страница города: заголовок для скринридера и меню", async ({ page }) => {
  await page.goto("/soroca");
  await expect(page.locator("h1")).toHaveText("Apetit Soroca");
  await expect(page.locator("main h2").first()).toBeVisible();
});

test("название с диакритикой рендерится", async ({ page }) => {
  await page.goto("/floresti");
  await expect(page.locator("h1")).toHaveText("Apetit Florești");
  await expect(page.getByRole("banner")).toContainText("Florești");
});

test("неизвестный город → 404", async ({ page }) => {
  const response = await page.goto("/chisinau");
  expect(response?.status()).toBe(404);
});
