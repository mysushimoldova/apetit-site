import { expect, test } from "@playwright/test";

test("страница города показывает название и заглушку меню", async ({
  page,
}) => {
  await page.goto("/soroca");
  await expect(page.locator("h1")).toHaveText("Soroca");
  await expect(page.getByText("[ТЕКСТ: меню скоро]")).toBeVisible();
});

test("название с диакритикой рендерится", async ({ page }) => {
  await page.goto("/floresti");
  await expect(page.locator("h1")).toHaveText("Florești");
});

test("неизвестный город → 404", async ({ page }) => {
  const response = await page.goto("/chisinau");
  expect(response?.status()).toBe(404);
});
