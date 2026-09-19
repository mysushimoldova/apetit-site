import { test } from "@playwright/test";

// Правовая страница и подвал меню — docs/screens/06-*.png (только телефон).

test("политика конфиденциальности", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    window.localStorage.setItem("apetit.city", "soroca"),
  );
  await page.goto("/confidentialitate");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.evaluate(() => document.fonts.ready);
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({
    path: "docs/screens/06-confidentialitate-390.png",
    fullPage: true,
  });
});

test("подвал меню", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await page.emulateMedia({ reducedMotion: "reduce" });
  // В корзине одно блюдо — видно, что панель корзины не закрывает подвал
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "apetit.cart",
      JSON.stringify({
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
      }),
    ),
  );
  await page.goto("/soroca");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.locator(".cart-bar[data-visible]").waitFor();
  await page.locator("footer").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  // Дождаться фото последнего экрана
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => {
        const r = img.getBoundingClientRect();
        return r.bottom > 0 && r.top < window.innerHeight;
      })
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({ path: "docs/screens/06-footer-390.png" });
});
