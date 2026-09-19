import { test, type Page } from "@playwright/test";

// Лист блюда (390 и 1280) и лист корзины (390) — docs/screens/04-*.png.
// Сценарий как в e2e: Kebab XL/XXL → XXL + sos de usturoi × 2.

async function prepare(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/soroca");
  await page.waitForFunction(() => document.readyState === "complete");
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
}

async function pick(page: Page, name: string | RegExp) {
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("label")
    .filter({ has: page.getByRole("radio", { name, exact: true }) })
    .or(
      dialog
        .locator("label")
        .filter({ has: page.getByRole("checkbox", { name, exact: true }) }),
    )
    .click();
}

async function imagesLoaded(page: Page) {
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("dialog img")).every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
}

async function openKebabXxl(page: Page) {
  await page
    .getByRole("button", { name: "Kebab XL / XXL", exact: true })
    .click();
  await pick(page, "XXL");
  await pick(page, /Sos de usturoi/);
  await page.getByRole("button", { name: "Mărește cantitatea" }).click();
  // Галочка внизу списка прокрутила лист — вернуть к фото и названию
  await page.locator(".sheet-body").evaluate((el) => (el.scrollTop = 0));
  await imagesLoaded(page);
}

test("лист блюда", async ({ page }, testInfo) => {
  await prepare(page);
  await openKebabXxl(page);
  await page.screenshot({
    path: `docs/screens/04-produs-${testInfo.project.name}.png`,
  });
});

test("лист корзины", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await prepare(page);
  await openKebabXxl(page);
  await page.getByRole("button", { name: "Adaugă · 228 lei" }).click();

  await page.getByRole("button", { name: "Kebab Cheese", exact: true }).click();
  await pick(page, "roșii");
  await page.getByRole("button", { name: /^Adaugă · / }).click();
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();

  await page.locator(".cart-bar").getByRole("button").click();
  await imagesLoaded(page);
  await page.screenshot({ path: "docs/screens/04-cos-390.png" });
});
