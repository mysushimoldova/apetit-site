import { test, type Page } from "@playwright/test";

// Оформление и подтверждение — docs/screens/05-*.png.
// Корзина: Kebab XL/XXL (XXL + sos de usturoi) × 2 + Coca-Cola, Сороки.

// Человек в Сороках разрешил геолокацию — в карточках точек видно расстояние
test.use({
  geolocation: { latitude: 48.16, longitude: 28.305 },
  permissions: ["geolocation"],
});

const OPEN = "2026-09-19T09:00:00Z"; // 12:00 в Кишинёве
const CLOSED = "2026-09-19T20:30:00Z"; // 23:30

async function prepare(page: Page, time: string) {
  await page.clock.setFixedTime(new Date(time));
  await page.setExtraHTTPHeaders({ "x-apetit-test-now": time });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "apetit.cart",
      JSON.stringify({
        state: {
          city: "soroca",
          lines: [
            {
              productSlug: "kebab-xl-xxl",
              variantId: "xxl",
              addonIds: ["sos-usturoi"],
              removedIds: [],
              qty: 2,
            },
            {
              productSlug: "cola",
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
  await page.goto("/soroca/comanda");
  await page.waitForFunction(() => document.readyState === "complete");
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
}

async function fill(page: Page) {
  const noua = page.getByRole("radio", { name: /Apetit Soroca Nouă/ });
  await page.locator("label").filter({ has: noua }).click();
  await page.getByLabel("Nume").fill("Ion Popescu");
  const phone = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  await page.getByLabel("Telefon").pressSequentially(`069${phone}`);
  await page.getByLabel("Adresă").fill("str. Independenței 12");
  await page.getByLabel("Adresă").blur();
}

test("оформление", async ({ page }, testInfo) => {
  await prepare(page, OPEN);
  await fill(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `docs/screens/05-comanda-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("оформление вне часов", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await prepare(page, CLOSED);
  await page.getByText("Primim comenzi 08:30–23:00").waitFor();
  await page.screenshot({
    path: "docs/screens/05-comanda-inchis-390.png",
    fullPage: true,
  });
});

test("подтверждение", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await prepare(page, OPEN);
  await fill(page);
  await page.getByRole("button", { name: "Trimite comanda" }).click();
  await page.waitForURL(/\/soroca\/comanda\/\d+$/);
  await page.getByText("Te sunăm în câteva minute").waitFor();
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({
    path: "docs/screens/05-confirmare-390.png",
    fullPage: true,
  });
});
