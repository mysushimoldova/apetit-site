import { expect, test } from "@playwright/test";
import { cssRules, open, OPEN_TIME, setTime, shot } from "./_shared";

// Что ломается именно на iPhone. Движок здесь настоящий — WebKit, тот же,
// что в Safari; профили iphone-14, iphone-se и desktop-safari.
test.skip(({ browserName }) => browserName !== "webkit", "только WebKit");

test("высота экрана: никакого «голого» 100vh", async ({ page }) => {
  await open(page, "/soroca");
  const rules = await cssRules(page);
  // Safari считает 100vh по экрану БЕЗ адресной строки: элемент вылезает
  // за низ окна. Можно только dvh/svh/lvh или запас в JS. Пара
  // «height: 100vh; height: 100lvh» — не нарушение: это запасное значение
  // для браузеров, которые lvh ещё не знают.
  const bare = rules.filter(
    (r) => r.text.includes("100vh") && !/1[0]0(l|d|s)vh/.test(r.text),
  );
  // В стилях есть и мёртвые правила: Tailwind собирает утилиты по всем
  // файлам, до которых дотянется, включая чужие в node_modules (так в сборку
  // попал .h-screen — им на сайте никто не пользуется). Спрашиваем только с
  // тех правил, под которые на странице есть живой элемент.
  const alive = await page.evaluate(
    (selectors) => selectors.filter((s) => document.querySelector(s) !== null),
    bare.map((r) => r.selector),
  );
  expect(alive, "правила с голым 100vh").toEqual([]);
});

/**
 * Нижний край элемента, когда тот перестал двигаться. Панель корзины и лист
 * выезжают снизу с анимацией: если померить сразу, они ещё в пути и
 * «вылезают» за низ окна — это не дефект, это кадр анимации.
 */
async function settledBottom(
  locator: import("@playwright/test").Locator,
): Promise<number> {
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const box = await locator.boundingBox();
    const bottom = box ? Math.round(box.y + box.height) : -1;
    if (bottom === last) return bottom;
    last = bottom;
    await locator.page().waitForTimeout(80);
  }
  return last;
}

for (const height of [844, 660]) {
  test(`адресная строка: при высоте окна ${height} видны кнопка заказа и корзина`, async ({
    page,
  }, info) => {
    test.skip(!info.project.name.startsWith("iphone"), "только телефон");
    await page.setViewportSize({ width: 390, height });
    await setTime(page, OPEN_TIME);
    await open(page, "/soroca");

    // Кладём блюдо — снизу выезжает панель корзины
    await page.getByRole("button", { name: "Adaugă: Kebab Cheese" }).click();
    const bar = page.locator(".cart-bar");
    await expect(bar).toBeVisible();
    expect(
      await settledBottom(bar),
      "панель корзины не влезла в окно",
    ).toBeLessThanOrEqual(height + 1);

    // Кнопка «Comandă» в корзине — тоже целиком в окне
    await bar.getByRole("button").click();
    const order = page
      .getByRole("dialog", { name: "Coș" })
      .getByRole("link", { name: "Comandă" });
    await expect(order).toBeVisible();
    expect(
      await settledBottom(order),
      "кнопка «Comandă» не влезла в окно",
    ).toBeLessThanOrEqual(height + 1);
    await shot(page, info, `ios-${height}-cos`);
  });
}

test("вырезы экрана: шапка и нижние панели считаются с safe-area", async ({
  page,
}) => {
  await open(page, "/soroca");
  const rules = await cssRules(page);

  // Вырезы экрана учитываются двумя способами: прямо через env(), либо через
  // переменную, которая сама объявлена от env() (--safe-top, --gutter-left,
  // --gutter-right в :root). Шапка, например, считается через --safe-top.
  const variables = rules
    .filter((r) => r.text.includes("env(safe-area-inset-"))
    .flatMap((r) => [...r.text.matchAll(/(--[\w-]+)\s*:[^;]*env\(safe-area/g)])
    .map((m) => m[1]);
  expect(variables, "переменных вырезов не нашлось").not.toEqual([]);

  const respects = (selector: string) =>
    rules.some(
      (r) =>
        r.selector.includes(selector) &&
        (r.text.includes("env(safe-area-inset-") ||
          variables.some((v) => r.text.includes(`var(${v}`))),
    );
  // Липкая шапка заходит под «чёлку», нижние панели — под полоску «домой»
  expect(respects(".site-header"), "шапка без safe-area").toBe(true);
  expect(respects(".cart-bar"), "панель корзины без safe-area").toBe(true);
  expect(respects(".sheet-footer"), "низ листа без safe-area").toBe(true);
  // Переменные вырезов объявлены и вычисляются
  const vars = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      top: s.getPropertyValue("--safe-top").trim(),
      left: s.getPropertyValue("--gutter-left").trim(),
    };
  });
  expect(vars.top).not.toBe("");
  expect(vars.left).not.toBe("");
});

test("масштаб: щипком не приближается, поля не мельче 16px", async ({
  page,
}) => {
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca/comanda");

  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport).toContain("maximum-scale=1");
  expect(viewport).toContain("viewport-fit=cover");

  const touchAction = await page.evaluate(() => [
    getComputedStyle(document.documentElement).touchAction,
    getComputedStyle(document.body).touchAction,
  ]);
  expect(touchAction).toEqual(["pan-x pan-y", "pan-x pan-y"]);

  // Поле меньше 16px — iOS приближает страницу сам, и никакой замок не спасёт
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input, textarea, select"))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => `${el.tagName.toLowerCase()}[${el.getAttribute("name")}]`),
  );
  expect(small, "поле со шрифтом меньше 16px").toEqual([]);
});

test("видео: playsinline и без звука (иначе iOS откроет на весь экран)", async ({
  page,
}) => {
  await open(page, "/soroca");
  const bad = await page.evaluate(() =>
    Array.from(document.querySelectorAll("video"))
      .filter((v) => !v.playsInline || !v.muted)
      .map((v) => v.currentSrc || "video"),
  );
  expect(bad, "видео без playsinline/muted").toEqual([]);
});

test("стекло: есть -webkit-дубль и запасной цвет без backdrop-filter", async ({
  page,
}) => {
  await open(page, "/soroca");
  const rules = await cssRules(page);
  const glass = rules.filter((r) => r.text.includes("backdrop-filter"));
  expect(glass.length, "правил со стеклом не нашлось").toBeGreaterThan(0);
  for (const rule of glass) {
    expect(
      rule.text,
      `${rule.selector}: нет -webkit-backdrop-filter`,
    ).toContain("-webkit-backdrop-filter");
  }
  // Запасной непрозрачный цвет — для браузера без backdrop-filter
  const header = page.locator("header.site-header");
  const background = await header.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(background, "у шапки нет заливки-запаски").not.toBe(
    "rgba(0, 0, 0, 0)",
  );
});
