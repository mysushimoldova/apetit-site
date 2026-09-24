import { expect, test } from "@playwright/test";
import { cssRules, open, OPEN_TIME, setTime, shot } from "./_shared";

// Что проверяем только на компьютере: наведение мышью, клавиатура, широкий
// экран, полоса прокрутки.
test.skip(({ isMobile }) => isMobile === true, "только компьютер");

test("наведение мышью — только там, где есть мышь", async ({ page }) => {
  await open(page, "/soroca");
  const rules = await cssRules(page);
  // :hover без защиты — на тачскрине даёт «залипший» вид после тапа
  const stray = rules
    .filter(
      (r) =>
        /:hover/.test(r.selector) &&
        !r.media.some((m) => m.replace(/ /g, "").includes("hover:hover")),
    )
    .map((r) => r.selector);
  expect(stray, ":hover вне @media (hover: hover)").toEqual([]);
});

test("клавиатура: города → меню → товар → корзина → заказ", async ({
  page,
  browserName,
}, info) => {
  await setTime(page, OPEN_TIME);
  // Safari по умолчанию не переводит Tab на ссылки — это его настройка
  // («Выделять каждый объект на странице»), а не наша беда. Поэтому на
  // WebKit ставим фокус сами и проверяем то, за что отвечаем мы: кольцо
  // фокуса, Enter, Esc и возврат фокуса.
  const tabToLinks = browserName !== "webkit";

  // Экран городов: Tab доходит до плитки, Enter открывает город
  await open(page, "/");
  const city = page.getByRole("link", { name: "Soroca" });
  if (tabToLinks) await page.keyboard.press("Tab");
  else await city.focus();
  await expect(city).toBeFocused();
  // Кольцо фокуса видно
  const outline = await city.evaluate(
    (el) => getComputedStyle(el).outlineWidth,
  );
  expect(outline, "у плитки города не видно фокуса").not.toBe("0px");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/soroca$/);
  await page.waitForFunction(() => document.readyState === "complete");

  // Меню: Tab идёт по шапке, чипам категорий и плиткам. Чипы — ссылки,
  // поэтому в Safari их спрашиваем отдельно (см. выше).
  const reached: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const what = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return "";
      const cls = typeof el.className === "string" ? el.className : "";
      if (cls.includes("chip")) return "chip";
      if (cls.includes("tile-open")) return "tile";
      if (cls.includes("add-button")) return "add";
      return el.tagName.toLowerCase();
    });
    if (what && !reached.includes(what)) reached.push(what);
    if (reached.includes("add")) break;
  }
  if (tabToLinks) {
    expect(reached, "Tab не дошёл до чипов категорий").toContain("chip");
  } else {
    // Чип — ссылка: в Safari фокус ставим сами, но кольцо обязано быть
    const chip = page.locator("nav.chips-row a").first();
    await chip.focus();
    await expect(chip).toBeFocused();
    expect(
      await chip.evaluate((el) => getComputedStyle(el).outlineWidth),
      "у чипа категории не видно фокуса",
    ).not.toBe("0px");
  }
  expect(reached, "Tab не дошёл до названия блюда").toContain("tile");
  expect(reached, "Tab не дошёл до кнопки «+»").toContain("add");

  // Лист блюда: открывается с клавиатуры, Esc закрывает, фокус возвращается
  const title = page.getByRole("button", { name: "Kebab Cheese", exact: true });
  await title.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Kebab Cheese" });
  await expect(sheet).toBeVisible();
  await shot(page, info, "desktop-fisa");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(title).toBeFocused();

  // Корзина: положить, открыть из шапки, Esc закрывает
  await page.getByRole("button", { name: "Adaugă: Kebab Cheese" }).click();
  await page.getByRole("banner").getByRole("button", { name: /Coș/ }).click();
  const cart = page.getByRole("dialog", { name: "Coș" });
  await expect(cart).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cart).toBeHidden();

  // Корзина уехала, но у неё есть ещё одно дело: снять свою запись из
  // истории браузера (кнопка «назад» закрывает лист, а не уводит со
  // страницы — src/components/sheet/sheet.tsx). Делается это сразу после
  // того, как лист убран со страницы, шагом history.back(). Жёсткий переход
  // ровно в этот миг браузер отменяет: ERR_ABORTED. Человеку в эту
  // миллисекунду не попасть — он ещё ведёт мышь, — а Playwright попадает
  // каждый раз. Поэтому даём листу договорить.
  await page.waitForTimeout(150);

  // Оформление: до кнопки отправки можно дойти клавишами
  await page.goto("/soroca/comanda");
  await page.waitForFunction(() => document.readyState === "complete");
  const submit = page.getByRole("button", { name: "Trimite comanda" });
  await expect(submit).toBeVisible();
  let found = false;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press("Tab");
    found = await submit.evaluate((el) => el === document.activeElement);
  }
  expect(found, "Tab не доходит до «Trimite comanda»").toBe(true);
  const ring = await submit.evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(ring, "у кнопки отправки не видно фокуса").not.toBe("0px");
});

test("широкий экран: у содержимого есть предел ширины", async ({
  page,
}, info) => {
  await open(page, "/soroca");
  const width = await page.evaluate(() => window.innerWidth);
  const main = await page
    .locator("main")
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        maxWidth: style.maxWidth,
        width: el.getBoundingClientRect().width,
      };
    });
  expect(main.maxWidth, "у содержимого нет max-width").not.toBe("none");
  // На 1920 контент не растягивается на всю ширину
  if (width >= 1900) {
    expect(main.width, "контент растянут на весь экран").toBeLessThanOrEqual(
      1200,
    );
  }
  await shot(page, info, "desktop-latime");
});

test("полоса прокрутки и стекло шапки на месте", async ({ page }) => {
  await open(page, "/soroca");
  // Шапка со стеклом: либо backdrop-filter, либо непрозрачная заливка-запаска
  const header = await page.locator("header.site-header").evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      backdrop:
        s.backdropFilter ||
        (s as unknown as { webkitBackdropFilter: string }).webkitBackdropFilter,
      background: s.backgroundColor,
      position: s.position,
    };
  });
  expect(header.position).toBe("sticky");
  const hasGlass = header.backdrop && header.backdrop !== "none";
  expect(
    hasGlass || header.background !== "rgba(0, 0, 0, 0)",
    "шапка без стекла и без заливки",
  ).toBe(true);

  // Полоса прокрутки не съедает содержимое: страница не едет вбок
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow, "страница шире окна").toBeLessThanOrEqual(0);
});
