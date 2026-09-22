import { test } from "@playwright/test";

// Контакты, общий подвал и русское меню — docs/screens/08-*.png.

const CART = JSON.stringify({
  state: {
    city: "soroca",
    lines: [
      {
        productSlug: "kebab-cheese",
        variantId: null,
        addonIds: [],
        removedIds: [],
        qty: 1,
      },
    ],
  },
  version: 1,
});

test("контакты", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/contacte");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.evaluate(() => document.fonts.ready);
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({
    path: `docs/screens/08-contacte-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("подвал на оформлении заказа", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    (cart) => window.localStorage.setItem("apetit.cart", cart),
    CART,
  );
  await page.goto("/soroca/comanda");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.evaluate(() => document.fonts.ready);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({ path: "docs/screens/08-subsol-390.png" });
});

test("меню по-русски", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/ru/soroca");
  await page.locator("main img").first().waitFor();
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({ path: "docs/screens/08-meniu-ru-390.png" });
});
