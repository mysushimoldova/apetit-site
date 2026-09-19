import { expect, test } from "@playwright/test";

test("страница города: заголовок для скринридера и меню", async ({ page }) => {
  await page.goto("/soroca");
  await expect(page.locator("h1")).toHaveText("Apetit Soroca");
  await expect(page.locator("main h2").first()).toBeVisible();
});

test("закрытая точка Florești — страницы больше нет (404)", async ({
  page,
}) => {
  const response = await page.goto("/floresti");
  expect(response?.status()).toBe(404);
});

test("неизвестный город → 404", async ({ page }) => {
  const response = await page.goto("/chisinau");
  expect(response?.status()).toBe(404);
});
