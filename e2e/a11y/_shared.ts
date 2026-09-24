// Общее для проверок доступности (axe-core).
//
// Проверяем настоящие страницы сайта, как их видит человек: экран городов,
// меню, шторку блюда, корзину, оформление заказа во всех состояниях,
// подтверждение, контакты, два правовых текста и 404 — на телефоне и на
// компьютере, по-румынски и по-русски.
//
// Чиним всё, что axe считает serious и critical. Нарушения уровня moderate
// разбираются отдельно: если правка меняет вид сайта, она идёт архитектору,
// а не в код.
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type TestInfo } from "@playwright/test";

/** Уровни, которые обязаны быть пустыми. */
export const BLOCKING = ["critical", "serious"] as const;

export interface Violation {
  id: string;
  impact: string;
  help: string;
  nodes: string[];
}

/**
 * Прогнать axe по открытой странице.
 * Возвращает нарушения; блокирующие проверяются вызывающим тестом.
 */
export async function scan(
  page: Page,
  where: string,
  options: { include?: string } = {},
): Promise<Violation[]> {
  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "best-practice",
  ]);
  if (options.include) builder = builder.include(options.include);
  const result = await builder.analyze();
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? "unknown",
    help: `${where}: ${v.help}`,
    nodes: v.nodes.map((n) => n.html.slice(0, 200)),
  }));
}

/** Нарушения serious и critical — падение теста с понятным перечислением.
 *
 *  Исключений нет: цвет ошибок формы (--color-closed) с 24.09.2026 стал
 *  #B93A2E и норму выполняет — прежнее послабление убрано. */
export function expectClean(violations: Violation[], where: string): void {
  const blocking = violations.filter((v) =>
    (BLOCKING as readonly string[]).includes(v.impact),
  );
  const text = blocking
    .map(
      (v) => `${v.impact} · ${v.id} · ${v.help}\n    ${v.nodes.join("\n    ")}`,
    )
    .join("\n");
  expect(blocking.length, `${where}: доступность\n${text}`).toBe(0);
}

/** Мягкие нарушения — в вывод прогона, чтобы попали в отчёт. */
export function reportModerate(violations: Violation[], info: TestInfo): void {
  const soft = violations.filter(
    (v) => !(BLOCKING as readonly string[]).includes(v.impact),
  );
  if (soft.length === 0) return;
  info.annotations.push({
    type: "axe-moderate",
    description: soft
      .map((v) => `${v.impact} · ${v.id} · ${v.help}`)
      .join("; "),
  });
}

/** Рабочее время: 12:00 в Кишинёве — заказ можно отправить. */
export const OPEN_TIME = "2026-09-19T09:00:00Z";

/** Поставить рабочее время и браузеру, и серверу (APETIT_E2E=1). */
export async function setOpenTime(page: Page): Promise<void> {
  await page.clock.setFixedTime(new Date(OPEN_TIME));
  await page.setExtraHTTPHeaders({ "x-apetit-test-now": OPEN_TIME });
}

/**
 * Открыть и дождаться, пока страница действительно встала: анимации входа
 * закончились. Иначе axe меряет контраст у ещё прозрачной плитки города и
 * ругается на то, чего человек никогда не увидит.
 */
export async function open(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState("load");
  // React успевает «оживить» страницу: без этого нажатие клавиши уходит в
  // никуда — обработчик ещё не навешен
  await page.waitForTimeout(800);
  await settle(page);
}

/**
 * Дождаться, пока страница перестанет двигаться: ни одной идущей
 * анимации и ни одного элемента, которому анимация ещё не вернула
 * непрозрачность (motion ставит opacity: 0 прямо в style до своего старта —
 * и axe считает такой текст невидимым, хотя человек его увидит).
 */
export async function settle(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => a.playState !== "running") &&
        document.querySelectorAll('[style*="opacity:0"], [style*="opacity: 0"]')
          .length === 0,
      undefined,
      { timeout: 4000 },
    )
    .catch(() => {
      // Бесконечных анимаций на сайте нет; если что — идём дальше
    });
}

/** Корзина в localStorage до загрузки страницы (формат zustand persist). */
export async function seedCart(
  page: Page,
  city: string,
  slugs: string[],
): Promise<void> {
  await page.addInitScript(
    ([c, list]) =>
      window.localStorage.setItem(
        "apetit.cart",
        JSON.stringify({
          state: {
            city: c,
            lines: (list as string[]).map((productSlug) => ({
              productSlug,
              variantId: null,
              addonIds: [],
              removedIds: [],
              qty: 1,
            })),
          },
          version: 1,
        }),
      ),
    [city, slugs] as const,
  );
}
