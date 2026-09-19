import { expect, test } from "@playwright/test";

const CITY_NAMES = ["Soroca", "Sculeni", "Florești", "Otaci", "Briceni"];
// Невидимый заголовок для скринридеров (DESIGN 2.1, ответ архитектора №4)
const SR_TITLE = "Alege orașul";

test("главная показывает 5 плиток и никакого другого текста", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto("/");
  const tiles = page.getByRole("link");
  await expect(tiles).toHaveCount(5);
  await expect(tiles).toHaveText(CITY_NAMES);
  // На экране больше нет никакого текста: ни подписи, ни логотипа. Единственное
  // исключение — заголовок для скринридеров, и он невидим (1×1px).
  // innerText учитывает text-transform, поэтому сравниваем без учёта регистра.
  const bodyText = await page.locator("body").innerText();
  const lines = bodyText
    .split("\n")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  expect(lines).toEqual([SR_TITLE, ...CITY_NAMES].map((n) => n.toUpperCase()));
  const heading = page.getByRole("heading", { level: 1, name: SR_TITLE });
  const box = await heading.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(1);
  expect(box?.height).toBeLessThanOrEqual(1);
  // Анимация входа отыграла — плитка видна и на месте
  await expect(tiles.last()).toHaveCSS("opacity", "1");
  expect(consoleErrors).toEqual([]);
});

test("плитки — ссылки на /[city]", async ({ page }) => {
  await page.goto("/");
  const tile = page.getByRole("link", { name: "Otaci" });
  await expect(tile).toHaveAttribute("href", "/otaci");
  // Web Interface Guidelines: без задержки двойного тапа, названия не переводятся
  await expect(tile).toHaveCSS("touch-action", "manipulation");
  await expect(page.locator("ul")).toHaveAttribute("translate", "no");
});

test("клик по Soroca ведёт на /soroca, повторное открытие / редиректит туда же", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Soroca" }).click();
  await expect(page).toHaveURL("/soroca");
  await expect(page.locator("h1")).toHaveText("Apetit Soroca");

  await page.goto("/", { waitUntil: "commit" });
  await expect(page).toHaveURL("/soroca");
  await expect(page.locator("h1")).toHaveText("Apetit Soroca");
});

test("мусор в localStorage не ломает главную", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("apetit.city", "chisinau"));
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("link")).toHaveCount(5);
});

test("prefers-reduced-motion: плитки видны без анимации и без ошибок гидратации", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const tile = page.getByRole("link", { name: "Briceni" });
  await expect(tile).toHaveCSS("opacity", "1");
  await expect(tile).toHaveCSS("transform", "none");
  // Плитка без motion: никаких inline-стилей и никакого несовпадения SSR/клиент.
  await expect(tile).not.toHaveAttribute("style", /.+/);
  expect(consoleErrors.filter((e) => /hydrat/i.test(e))).toEqual([]);
});

test.describe("десктоп", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("сетка 3 колонки (ряд 3 + ряд 2), плитки 200px высотой", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    // Ждём гидратацию: при reduced-motion плитки становятся обычными ссылками
    // без inline-стилей; мерить раньше — поймать отвязанный элемент.
    const tiles = page.getByRole("link");
    await expect(tiles).toHaveCount(5);
    await expect(tiles.last()).not.toHaveAttribute("style", /.+/);
    const boxes = [];
    for (const name of CITY_NAMES) {
      const box = await page.getByRole("link", { name }).boundingBox();
      expect(box).not.toBeNull();
      boxes.push(box!);
    }
    // Первые три — в одном ряду, четвёртая и пятая — во втором
    expect(boxes[0].y).toBe(boxes[1].y);
    expect(boxes[1].y).toBe(boxes[2].y);
    expect(boxes[3].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[3].y).toBe(boxes[4].y);
    // Колонки по 1fr: одинаковая ширина, 4-я под 1-й, 5-я под 2-й
    for (const box of boxes) {
      expect(Math.round(box.width)).toBe(Math.round(boxes[0].width));
      expect(Math.round(box.height)).toBe(200);
    }
    expect(boxes[3].x).toBe(boxes[0].x);
    expect(boxes[4].x).toBe(boxes[1].x);
  });
});
