import { expect, test, type Page } from "@playwright/test";

// Заставка категории (docs/motion/splash-prompt.md) на телефоне 390 px.
//
// Важная особенность: ролики не грузятся при открытии сайта. Первое
// нажатие на категорию заставки не показывает — оно только ставит ролики
// в загрузку. Поэтому каждый тест сначала «прогревает» категорию.

const MENU = "/soroca";
const CATEGORY = "drinks";

/** Заставка на экране? */
const splashOn = (page: Page) =>
  page.evaluate(() => document.documentElement.hasAttribute("data-splash"));

function chip(page: Page, slug: string) {
  return page.locator(`.chips-row a[data-slug="${slug}"]`);
}

/** Открыть меню и дождаться движка. */
async function openMenu(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(MENU);
  await page.waitForLoadState("load");
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  return errors;
}

/** Первое нажатие — ролики грузятся; ждём и возвращаемся к первой категории. */
async function warmUp(page: Page, slug = CATEGORY): Promise<void> {
  await chip(page, slug).click();
  await page.waitForTimeout(4000);
  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);
}

test("первое нажатие — без заставки, второе — с заставкой; потом сетка на месте", async ({
  page,
}) => {
  const errors = await openMenu(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(400);
  expect(await splashOn(page), "первое нажатие — заставки нет").toBe(false);

  await page.waitForTimeout(4000);
  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "второе нажатие — заставка играет").toBe(true);
  await expect(page.locator(".splash[data-on]")).toHaveCount(1);
  await expect(page.locator(".splash-word")).toHaveText("Drinks");

  // Заставка уходит сама и оставляет страницу на выбранной категории
  await page.waitForTimeout(2000);
  expect(await splashOn(page)).toBe(false);
  const top = await page.evaluate(
    () => document.getElementById("drinks")!.getBoundingClientRect().top,
  );
  expect(Math.abs(top), "сетка категории — сразу под шапкой").toBeLessThan(140);

  // Ничего не вылезло вбок и никто не ругался
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("касание в середине — заставка уходит сразу", async ({ page }) => {
  await openMenu(page);
  await warmUp(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  await page.locator(".splash").click({ position: { x: 195, y: 420 } });
  // Уход — 320 мс при настройках по умолчанию
  await page.waitForTimeout(500);
  expect(await splashOn(page), "после касания заставки нет").toBe(false);
});

test("кнопка «назад» закрывает заставку, а не уводит со страницы", async ({
  page,
}) => {
  await openMenu(page);
  await warmUp(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  await page.goBack();
  await page.waitForTimeout(600);
  expect(await splashOn(page)).toBe(false);
  await expect(page).toHaveURL(/\/soroca/);
  await expect(page.locator(".chips-row")).toBeVisible();
});

test("«уменьшить движение» — заставки нет совсем", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMenu(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(4000);
  await chip(page, "kebab").click();
  await page.waitForTimeout(800);
  await chip(page, CATEGORY).click();
  await page.waitForTimeout(400);
  expect(await splashOn(page)).toBe(false);
});

test("экономия трафика — заставки нет и ролики не грузятся", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "4g" },
    });
  });
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(r.url());
  });
  await openMenu(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(1500);
  await chip(page, CATEGORY).click();
  await page.waitForTimeout(600);
  expect(await splashOn(page)).toBe(false);
  expect(requests, "ролики не запрашивались").toEqual([]);
});

test("ролики не грузятся при открытии страницы", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(r.url());
  });
  await openMenu(page);
  await page.waitForTimeout(1500);
  expect(requests).toEqual([]);
});

test("у категории без роликов заставки нет", async ({ page }) => {
  const errors = await openMenu(page);
  for (let i = 0; i < 2; i++) {
    await chip(page, "menu").click();
    await page.waitForTimeout(1200);
    expect(await splashOn(page)).toBe(false);
  }
  expect(errors).toEqual([]);
});
