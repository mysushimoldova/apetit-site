import { expect, test, type Page } from "@playwright/test";

// Гидратация: разметка с сервера и то, что React собирает в браузере, должны
// совпадать до буквы. Ошибка «A tree hydrated but some attributes… didn't
// match» приходила из-за переменных CSS на атрибуте style у <html>: стоило
// любому коду до гидратации тронуть этот style (блокировка прокрутки у листа,
// панель /dev/motion, расширение браузера), как браузер переписывал атрибут
// по-своему, и React считал это расхождением. Теперь переменные приходят
// правилом :root в <style> (src/lib/root-css.ts), а у <html> атрибута style
// нет вовсе — сверять нечего.
//
// Проверка жёсткая: в консоли не должно быть ни одной ошибки, ни одного
// необработанного исключения.

/** Собирает всё, на что ругается браузер. */
function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    // Драйвер видеокарты на сборочной машине пишет свои замечания о
    // производительности — к странице они отношения не имеют
    if (message.text().includes("GL Driver Message")) return;
    problems.push(`консоль: ${message.text()}`);
  });
  page.on("pageerror", (error) =>
    problems.push(`исключение: ${error.message}`),
  );
  return problems;
}

const PAGES = [
  ["меню города", "/soroca"],
  ["экран городов", "/"],
  ["оформление заказа", "/soroca/comanda"],
  ["меню на русском", "/ru/soroca"],
  ["панель движения", "/dev/motion"],
] as const;

for (const [name, path] of PAGES) {
  test(`${path} (${name}): в консоли пусто`, async ({ page }) => {
    const problems = collectProblems(page);
    await page.goto(path);
    await page.waitForLoadState("load");
    // Движок подключается после показа страницы — даём ему завестись
    await page.waitForTimeout(1500);
    expect(problems).toEqual([]);
  });
}

test("style у <html> трогают до гидратации — ошибки всё равно нет", async ({
  page,
}) => {
  const problems = collectProblems(page);
  // Ровно то, что ломало гидратацию раньше: чужой код меняет style
  // корневого элемента, браузер переписывает атрибут своей записью
  await page.addInitScript(() => {
    const touch = () => {
      const html = document.documentElement;
      if (!html) {
        requestAnimationFrame(touch);
        return;
      }
      html.style.setProperty("padding-right", "0px");
      html.style.removeProperty("padding-right");
    };
    touch();
  });
  await page.goto("/soroca");
  await page.waitForLoadState("load");
  await page.waitForTimeout(1500);
  expect(problems).toEqual([]);
  // Атрибута style у <html> в разметке нет — значит React нечего сверять
  await expect(page.locator("html")).not.toHaveAttribute("style", /--color/);
});

test("переменные из motion.json приходят правилом :root, а не атрибутом", async ({
  page,
}) => {
  await page.goto("/soroca");
  const vars = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      cream: style.getPropertyValue("--color-cream").trim(),
      glass: style.getPropertyValue("--glass-bg").trim(),
      shadow: style.getPropertyValue("--sh-aw").trim(),
      stagger: style.getPropertyValue("--pv-stagger").trim(),
    };
  });
  expect(vars.cream).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(vars.glass).toMatch(/^rgba\(/);
  expect(vars.shadow).toMatch(/%$/);
  expect(Number(vars.stagger)).toBeGreaterThanOrEqual(0);
});
