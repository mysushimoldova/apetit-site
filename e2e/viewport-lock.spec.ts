import { expect, test } from "@playwright/test";

// Замок масштабирования на телефоне: сайт статичен, как печатное меню.
// Щипком и двойным тапом страница не приближается. Замков два, потому что
// iOS Safari слушается то мета-тега, то CSS:
//   1) meta viewport: maximum-scale=1, user-scalable=no (src/routes/root.tsx);
//   2) touch-action: pan-x pan-y на html и body (globals.css).
// Третье условие — поля ввода не меньше 16px: иначе iOS приближает страницу
// сам, когда палец попадает в поле, и никакой замок не поможет.

const PAGES = ["/soroca", "/", "/soroca/comanda", "/ru/soroca", "/contacte"];

for (const path of PAGES) {
  test(`${path}: мета-тег запрещает масштабирование`, async ({ page }) => {
    await page.goto(path);
    const meta = page.locator('meta[name="viewport"]');
    await expect(meta).toHaveCount(1);
    const content = (await meta.getAttribute("content")) ?? "";
    expect(content).toContain("width=device-width");
    expect(content).toContain("initial-scale=1");
    expect(content).toContain("maximum-scale=1");
    expect(content).toContain("user-scalable=no");
    // Вырезы экрана iPhone — как было
    expect(content).toContain("viewport-fit=cover");
  });

  test(`${path}: у html и body touch-action = pan-x pan-y`, async ({
    page,
  }) => {
    await page.goto(path);
    const touch = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).touchAction,
      body: getComputedStyle(document.body).touchAction,
    }));
    expect(touch.html).toBe("pan-x pan-y");
    expect(touch.body).toBe("pan-x pan-y");
  });
}

test("оформление заказа: во всех полях шрифт не меньше 16px", async ({
  page,
}) => {
  await page.goto("/soroca/comanda");
  await page.waitForLoadState("load");
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")].map((el) => ({
      name: el.getAttribute("name") ?? el.getAttribute("type") ?? el.tagName,
      size: Number.parseFloat(getComputedStyle(el).fontSize),
    })),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const field of sizes) {
    expect(field.size, `поле ${field.name}`).toBeGreaterThanOrEqual(16);
  }
});

test("лист блюда: поля и переключатели тоже не меньше 16px", async ({
  page,
}) => {
  await page.goto("/soroca");
  await page.getByRole("button", { name: "Kebab Cheese", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Kebab Cheese" }),
  ).toBeVisible();
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .map((el) => Number.parseFloat(getComputedStyle(el).fontSize))
      .filter((size) => size < 16),
  );
  expect(small).toEqual([]);
});

test("прокрутка и лента чипов работают, замок им не мешает", async ({
  page,
}) => {
  await page.goto("/soroca");
  // Страница листается вниз
  await page.mouse.wheel(0, 1200);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(500);
  // Лента чипов едет вбок
  const chips = page.getByRole("navigation", { name: /Categorii|Категории/ });
  const moved = await chips.evaluate((el) => {
    const before = el.scrollLeft;
    el.scrollLeft = before + 120;
    return el.scrollLeft > before;
  });
  expect(moved).toBe(true);
});
