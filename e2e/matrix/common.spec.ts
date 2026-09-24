import { expect, test } from "@playwright/test";
import {
  cartLine,
  open,
  OPEN_TIME,
  orderCleanup,
  seedCart,
  setTime,
  shot,
  TEST_NAME,
} from "./_shared";
import { guardTelegram } from "../telegram-guard";

// Проверки, одинаковые на всех восьми профилях: «уменьшить движение»,
// медленная сеть и недоступный сервер на отправке заказа.

// Проверка про медленный сервер оформляет НАСТОЯЩИЙ заказ — убираем за собой
const uniquePhone = orderCleanup(test);
// Ни одного запроса к Telegram из тестов — иначе тест падает
guardTelegram(test);

test("«уменьшить движение»: ничего не едет, фон стоит", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");

  // Все длительности — 180 мс (globals.css → prefers-reduced-motion).
  // Именно 180, а не ноль: «уменьшить движение» — равноценная версия, всё
  // появляется и исчезает одной прозрачностью (docs/MOTION.md §6, решение
  // архитектора 24.09.2026). Safari пишет «0.18s», Chromium — «180ms»,
  // поэтому сравниваем числа в миллисекундах.
  const durations = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ["--dur-fast", "--dur-state", "--dur-in", "--dur-slow"].map((n) => {
      const value = s.getPropertyValue(n).trim();
      const number = parseFloat(value);
      return value.endsWith("ms") ? number : number * 1000;
    });
  });
  expect(durations, "длительности не равны 180 мс").toEqual([
    180, 180, 180, 180,
  ]);

  // Ничего не сдвинуто: transform у карточек и теней — none. Прозрачность
  // не трогаем: при «уменьшить движение» появление оставлено (карточка ниже
  // экрана честно прозрачна, пока до неё не долистали) — так решено раньше,
  // см. e2e/products.spec.ts «только проявление, без сдвигов».
  const moving = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll(".food-reveal, .food-shadow, .food-lift"),
    )
      .filter((el) => {
        const value = getComputedStyle(el).transform;
        return value !== "none" && value !== "matrix(1, 0, 0, 1, 0, 0)";
      })
      .map((el) => (el.className as string).slice(0, 40)),
  );
  expect(moving, "карточки остались сдвинутыми").toEqual([]);

  // Фон не перерисовывается: два кадра подряд одинаковы
  const canvas = page.locator("canvas.motion-canvas");
  if ((await canvas.count()) > 0) {
    const frames = await page.evaluate(async () => {
      const stats = (
        window as unknown as { __apetitMotion?: () => { frames?: number } }
      ).__apetitMotion;
      if (!stats) return null;
      const a = stats().frames ?? 0;
      await new Promise((r) => setTimeout(r, 700));
      return [a, stats().frames ?? 0] as const;
    });
    if (frames) {
      expect(frames[1] - frames[0], "фон продолжает рисоваться").toBeLessThan(
        3,
      );
    }
  }
  await shot(page, info, "30-reduced-motion");
});

test("медленный сервер: кнопка ждёт, второе нажатие второго заказа не создаёт", async ({
  page,
}) => {
  await setTime(page, OPEN_TIME);
  await seedCart(page, "soroca", [cartLine("kebab-cheese")]);

  // Заказ уходит серверным действием — это POST на тот же адрес.
  // Задерживаем ответ на 3 секунды и считаем попытки.
  let attempts = 0;
  await page.route("**/soroca/comanda", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });

  await open(page, "/soroca/comanda");
  const centru = page.getByRole("radio", { name: /Apetit Centru/ });
  await page.locator("label").filter({ has: centru }).click();
  await page.getByLabel("Nume").fill(TEST_NAME);
  await page.getByLabel("Telefon").pressSequentially(uniquePhone());

  const submit = page.getByRole("button", {
    name: /Trimite comanda|Se trimite/,
  });
  await submit.click();

  // Пока ждём ответа — кнопка занята и повторно не срабатывает
  await expect(submit).toHaveAttribute("aria-busy", "true");
  await expect(submit).toBeDisabled();
  await submit.click({ force: true }).catch(() => {});
  await submit.click({ force: true }).catch(() => {});

  await expect(page).toHaveURL(/\/soroca\/comanda\/\d{4,}$/, {
    timeout: 30_000,
  });
  expect(attempts, "заказ ушёл больше одного раза").toBe(1);
});

test("сервер не отвечает: понятная ошибка, ничего не зависает", async ({
  page,
}, info) => {
  await setTime(page, OPEN_TIME);
  await seedCart(page, "soroca", [cartLine("kebab-cheese")]);

  await page.route("**/soroca/comanda", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.abort("failed");
  });

  await open(page, "/soroca/comanda");
  const centru = page.getByRole("radio", { name: /Apetit Centru/ });
  await page.locator("label").filter({ has: centru }).click();
  await page.getByLabel("Nume").fill(TEST_NAME);
  await page.getByLabel("Telefon").pressSequentially("069123456");
  await page.getByRole("button", { name: "Trimite comanda" }).click();

  // Текст на румынском, из словаря — не «Error» и не пустота
  // p[role=alert] — наше сообщение; у Next есть свой невидимый role=alert
  // (объявление смены маршрута для скринридера), его не трогаем
  const alert = page.locator("p[role=alert]");
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toHaveText(/[a-zA-Zăâîșț]{4,}/);
  // Кнопка снова живая: можно нажать ещё раз
  await expect(
    page.getByRole("button", { name: "Trimite comanda" }),
  ).toBeEnabled();
  // Корзина на месте — введённое не потеряно
  await expect(page.getByLabel("Nume")).toHaveValue(TEST_NAME);
  await shot(page, info, "31-server-nu-raspunde");
});

test("сервер не отвечает: на русском ошибка тоже по-русски", async ({
  page,
}) => {
  await setTime(page, OPEN_TIME);
  await seedCart(page, "soroca", [cartLine("kebab-cheese")]);
  await page.route("**/ru/soroca/comanda", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.abort("failed");
  });

  await open(page, "/ru/soroca/comanda");
  const centru = page.getByRole("radio", {
    name: /Апетит Центру|Apetit Centru/,
  });
  await page.locator("label").filter({ has: centru }).click();
  await page.getByLabel("Имя").fill(TEST_NAME);
  await page.getByLabel("Телефон").pressSequentially("069123456");
  await page.getByRole("button", { name: "Отправить заказ" }).click();

  // p[role=alert] — наше сообщение; у Next есть свой невидимый role=alert
  // (объявление смены маршрута для скринридера), его не трогаем
  const alert = page.locator("p[role=alert]");
  await expect(alert).toBeVisible({ timeout: 30_000 });
  await expect(alert).toHaveText(/[А-Яа-яЁё]{4,}/);
});

// Фон сайта — холст WebGL (src/motion). Проверки живут здесь, а не в
// ios.spec.ts, хотя писались ради iPhone: WebKit в сборке Playwright под
// Windows идёт без WebGL, холста там нет вовсе, и проверка молча
// пропускалась. На Chromium-профилях холст настоящий, и правила те же —
// именно они ловят «линии рассыпались в пунктир».

test("фон: холст рисуется в настоящую плотность точек экрана", async ({
  page,
}, info) => {
  await open(page, "/soroca");
  const canvas = page.locator("canvas.motion-canvas");
  if ((await canvas.count()) === 0) {
    test.skip(true, "в этом браузере нет WebGL — движок фона выключен");
  }
  await canvas.waitFor({ state: "attached" });

  // Если холст меньше экрана в точках, линия ложится между пикселями и
  // рассыпается в пунктир — ровно то, что было видно на iPhone
  const size = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const rect = c.getBoundingClientRect();
    return {
      width: c.width,
      cssWidth: rect.width,
      dpr: window.devicePixelRatio,
    };
  });
  expect(size.width, "холст ниже плотности экрана").toBe(
    Math.round(size.cssWidth * size.dpr),
  );

  // Снимок в полной плотности — чтобы посмотреть на линии глазами
  if (info.project.use.isMobile === true) {
    await shot(page, info, "32-fundal", { density: true });
  }
});

test("фон: настройки WebGL под Safari, потеря контекста не красит экран", async ({
  page,
}) => {
  await open(page, "/soroca");
  const canvas = page.locator("canvas.motion-canvas");
  if ((await canvas.count()) === 0) {
    test.skip(true, "в этом браузере нет WebGL — движок фона выключен");
  }

  const attrs = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ??
      c.getContext("webgl")) as WebGLRenderingContext | null;
    return gl?.getContextAttributes() ?? null;
  });
  // Safari на iOS складывает холст со страницей только как premultiplied —
  // иначе полупрозрачные линии выходят светлее фона (src/motion/gl.ts)
  expect(attrs?.premultipliedAlpha, "premultipliedAlpha").toBe(true);
  expect(attrs?.alpha, "холст должен быть прозрачным").toBe(true);

  // Отбираем контекст: страница обязана остаться прежней, без чёрного или
  // белого прямоугольника на весь экран
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ??
      c.getContext("webgl")) as WebGLRenderingContext | null;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });
  await page.waitForTimeout(500);
  expect(errors, "потеря контекста уронила страницу").toEqual([]);
  const background = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(background, "фон стал чёрным").not.toBe("rgb(0, 0, 0)");
  expect(background, "фон стал белым").not.toBe("rgb(255, 255, 255)");
  await expect(page.getByRole("banner")).toBeVisible();
});
