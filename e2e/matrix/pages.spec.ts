import { expect, test } from "@playwright/test";
import {
  auditPage,
  cartLine,
  installCls,
  open,
  OPEN_TIME,
  seedCart,
  setTime,
  shot,
  watchProblems,
} from "./_shared";

// Каждая страница сайта на каждом профиле: ошибки браузера, горизонтальный
// скролл, сдвиги вёрстки, шрифты, картинки, обрезанный текст, размер
// кликабельного, живые ссылки, снимок.

interface Screen {
  /** Имя файла снимка и колонка в таблице отчёта. */
  screen: string;
  path: string;
  /** Положить корзину до загрузки (оформление заказа без неё пустое). */
  cart?: boolean;
  /** Ожидаемый ответ сервера (по умолчанию 200). */
  status?: number;
}

const SCREENS: Screen[] = [
  { screen: "01-orase", path: "/" },
  { screen: "02-meniu", path: "/soroca" },
  { screen: "03-contacte", path: "/contacte" },
  { screen: "04-confidentialitate", path: "/confidentialitate" },
  { screen: "05-termeni", path: "/termeni" },
  { screen: "06-comanda", path: "/soroca/comanda", cart: true },
  { screen: "07-ru-orase", path: "/ru" },
  { screen: "08-ru-meniu", path: "/ru/soroca" },
  { screen: "09-ru-contacte", path: "/ru/contacte" },
  { screen: "10-ru-confidentialitate", path: "/ru/confidentialitate" },
  { screen: "11-ru-termeni", path: "/ru/termeni" },
  { screen: "12-ru-comanda", path: "/ru/soroca/comanda", cart: true },
  { screen: "13-404", path: "/nu-exista-asa-pagina", status: 404 },
];

for (const item of SCREENS) {
  test(`${item.screen} (${item.path})`, async ({ page, request }, info) => {
    const problems = watchProblems(page, {
      expect404: item.status === 404 ? item.path : undefined,
    });
    await installCls(page);
    await setTime(page, OPEN_TIME);
    if (item.cart) {
      await seedCart(page, "soroca", [
        cartLine("kebab-cheese"),
        cartLine("mozza-crispy", 2),
      ]);
    }
    const response = await page.goto(item.path);
    expect(response?.status(), `${item.path}: ответ сервера`).toBe(
      item.status ?? 200,
    );
    await page.waitForLoadState("load");
    // Движок фона подключается после показа страницы — даём ему завестись
    await page.waitForTimeout(800);

    await auditPage(page, info, problems, { screen: item.screen, request });
  });
}

// Меню Soroca Centru: каждая категория по очереди. Чип ведёт к секции,
// секция встаёт под липкой шапкой, вывеска на месте, страница не едет вбок.
test("меню: все категории по очереди", async ({ page }, info) => {
  const problems = watchProblems(page);
  await installCls(page);
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");

  const chips = page.locator("nav.chips-row [data-slug]");
  const slugs = await chips.evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).dataset.slug!),
  );
  expect(slugs.length, "категорий в ленте").toBe(11);

  for (const slug of slugs) {
    await page.locator(`nav.chips-row [data-slug="${slug}"]`).click();
    const section = page.locator(`#${slug}`);
    await expect(section).toBeVisible();
    // Дождаться конца плавной прокрутки
    await expect
      .poll(async () => {
        const before = await page.evaluate(() => window.scrollY);
        await page.waitForTimeout(250);
        return before === (await page.evaluate(() => window.scrollY));
      })
      .toBe(true);
    await expect(
      page.locator(`nav.chips-row [data-slug="${slug}"]`),
    ).toHaveAttribute("aria-current", "true");
    // Вывеска категории видна, и страница не уехала вбок
    const wide = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(wide, `категория ${slug}: страница шире экрана`).toBeLessThanOrEqual(
      0,
    );
  }

  await shot(page, info, "14-categorie");
  expect(problems.list, "меню по категориям: браузер ругается").toEqual([]);
});
