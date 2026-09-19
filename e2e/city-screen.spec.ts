import { expect, test } from "@playwright/test";

const CITY_NAMES = ["Soroca", "Sculeni", "Florești", "Otaci", "Briceni"];

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
  // На экране больше нет никакого текста: ни заголовка, ни подписи, ни логотипа.
  // innerText учитывает text-transform, поэтому сравниваем без учёта регистра.
  const bodyText = await page.locator("body").innerText();
  const lines = bodyText
    .split("\n")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  expect(lines).toEqual(CITY_NAMES.map((n) => n.toUpperCase()));
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
  await expect(page.locator("h1")).toHaveText("Soroca");

  await page.goto("/", { waitUntil: "commit" });
  await expect(page).toHaveURL("/soroca");
  await expect(page.locator("h1")).toHaveText("Soroca");
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
