import { expect, test, type Page } from "@playwright/test";

// Заставка категории (docs/motion/splash-prompt.md) на телефоне 390 px.
//
// Заставка есть у каждой категории: где снят ролик — играет ролик, где нет
// (pizza, menu, crispy, hot-dog, cartofi) — та же заставка, но с вырезанным
// фото первого доступного в точке блюда.
//
// Важная особенность: ни ролики, ни фото не грузятся при открытии сайта.
// Первое нажатие на категорию заставки не показывает — оно только ставит
// их в загрузку. Поэтому каждый тест сначала «прогревает» категорию.

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

// ---------------------------------------------------------------------------
// Категории без ролика: заставка из фото
// ---------------------------------------------------------------------------

/** Меню Briceni: там есть пицца (в Сороках её нет — point-products.ts). */
const PIZZA_MENU = "/briceni";

test("pizza: заставка с фото появилась и ушла", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  const photos: string[] = [];
  page.on("request", (r) => {
    if (/\/img\/products\/pizza-/.test(r.url())) photos.push(r.url());
  });

  await page.goto(PIZZA_MENU);
  await page.waitForLoadState("load");
  await page
    .locator("canvas.motion-canvas[data-ready]")
    .waitFor({ state: "attached" });

  // Первое нажатие — фото только встаёт в загрузку, заставки нет
  await chip(page, "pizza").click();
  await page.waitForTimeout(400);
  expect(await splashOn(page), "первое нажатие — заставки нет").toBe(false);
  await page.waitForTimeout(2500);

  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);

  // Второе — заставка играет, и это фото, а не ролик: ни одного запроса
  // к /splash/ у категории без ролика быть не может
  await chip(page, "pizza").click();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "второе нажатие — заставка играет").toBe(true);
  await expect(page.locator(".splash[data-on]")).toHaveCount(1);
  await expect(page.locator(".splash-word")).toHaveText("Pizza");
  expect(photos.length, "фото пиццы запрошено").toBeGreaterThan(0);

  // Уходит сама и оставляет страницу на выбранной категории
  await page.waitForTimeout(2000);
  expect(await splashOn(page), "заставка ушла").toBe(false);
  const top = await page.evaluate(
    () => document.getElementById("pizza")!.getBoundingClientRect().top,
  );
  expect(Math.abs(top), "сетка категории — сразу под шапкой").toBeLessThan(140);
  expect(errors).toEqual([]);
});

test("фото-заставка: ролики для такой категории не грузятся", async ({
  page,
}) => {
  const videos: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) videos.push(r.url());
  });
  await page.goto(PIZZA_MENU);
  await page.waitForLoadState("load");
  for (let i = 0; i < 2; i++) {
    await chip(page, "pizza").click();
    await page.waitForTimeout(2500);
  }
  expect(videos, "у категории без ролика ролики не запрашиваются").toEqual([]);
});

test("фото-заставка при «уменьшить движение» — заставки нет", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PIZZA_MENU);
  await page.waitForLoadState("load");
  for (let i = 0; i < 2; i++) {
    await chip(page, "pizza").click();
    await page.waitForTimeout(2500);
  }
  expect(await splashOn(page)).toBe(false);
});

test("hot-dog: ролика нет, фото есть — заставка играет", async ({ page }) => {
  const errors = await openMenu(page);
  await chip(page, "hot-dog").click();
  await page.waitForTimeout(2500);
  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);

  await chip(page, "hot-dog").click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);
  await page.waitForTimeout(2000);
  expect(await splashOn(page)).toBe(false);
  expect(errors).toEqual([]);
});
