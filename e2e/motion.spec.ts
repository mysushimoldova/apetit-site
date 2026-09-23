import { expect, test, type Page } from "@playwright/test";

// Движок анимаций (src/motion/engine.ts) и его слои: живой фон из фирменных
// контурных линий (DESIGN.md → Background) и карточки блюд, которые
// приподнимаются при прокрутке (см. e2e/products.spec.ts).
//
// В разработке движок отдаёт свои показания через window.__apetitMotion():
// кадры, уровень качества, причины пауз. На боевой сборке этого нет.

interface Stats {
  quality: number;
  fps: number;
  frames: number;
  running: boolean;
  paused: string[];
  reducedMotion: boolean;
  scroll: number;
  layers: string[];
}

type MotionWindow = Window & { __apetitMotion?: () => Stats };

const stats = (page: Page): Promise<Stats | null> =>
  page.evaluate(
    () => (window as unknown as MotionWindow).__apetitMotion?.() ?? null,
  );

/** Дождаться первого нарисованного кадра. */
async function waitForCanvas(page: Page) {
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  await expect
    .poll(async () => (await stats(page))?.layers)
    .toEqual(["contours", "products"]);
}

/** Непустая корзина: с пустой страница оформления уводит в меню. */
async function seedCart(page: Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      "apetit.cart",
      JSON.stringify({
        state: {
          city: "soroca",
          lines: [
            {
              productSlug: "cola",
              variantId: null,
              addonIds: [],
              removedIds: [],
              qty: 1,
            },
          ],
        },
        version: 1,
      }),
    ),
  );
}

for (const path of ["/", "/soroca", "/soroca/comanda", "/termeni"]) {
  test(`${path}: холст за контентом, клики проходят сквозь`, async ({
    page,
  }) => {
    if (path.endsWith("/comanda")) await seedCart(page);
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await waitForCanvas(page);

    const style = await page.locator("canvas.motion-canvas").evaluate((el) => {
      const stage = getComputedStyle(el.parentElement!);
      const canvas = el as HTMLCanvasElement;
      return {
        position: stage.position,
        zIndex: stage.zIndex,
        pointerEvents: stage.pointerEvents,
        overflow: stage.overflow,
        // Холст в пикселях экрана: ширина окна × плотность
        width: canvas.width,
        height: canvas.height,
        cssWidth: Math.round(canvas.getBoundingClientRect().width),
      };
    });
    expect(style.position).toBe("fixed");
    expect(style.zIndex).toBe("-1");
    expect(style.pointerEvents).toBe("none");
    expect(style.overflow).toBe("hidden");
    expect(style.cssWidth).toBe(390);
    expect(style.width).toBeGreaterThan(390);

    // В центре экрана верхний элемент — контент, не холст
    const hitsCanvas = await page.evaluate(() => {
      const el = document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2,
      );
      return el?.tagName === "CANVAS";
    });
    expect(hitsCanvas).toBe(false);
  });
}

test("движок подключается после показа страницы", async ({ page }) => {
  // Замечаем момент, когда холст появился в странице: смотрим каждый кадр
  // с самого начала (MutationObserver тут не поставить — на старте
  // документа ещё нет корневого элемента)
  await page.addInitScript(() => {
    const w = window as unknown as { __canvasAt: number };
    w.__canvasAt = -1;
    const tick = () => {
      if (document.querySelector("canvas.motion-canvas")) {
        w.__canvasAt = performance.now();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.goto("/soroca");
  await waitForCanvas(page);
  const timing = await page.evaluate(() => {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    return {
      canvasAt: (window as unknown as { __canvasAt: number }).__canvasAt,
      load: nav.loadEventEnd,
    };
  });
  expect(timing.canvasAt).toBeGreaterThanOrEqual(timing.load);
});

test("фон живёт и следует за прокруткой", async ({ page }) => {
  await page.goto("/soroca");
  await waitForCanvas(page);
  const before = (await stats(page))!;
  expect(before.running).toBe(true);
  expect(before.scroll).toBeCloseTo(0, 1);

  await page.evaluate(() => window.scrollTo(0, 1200));
  // Сглаживание подтягивает значение к прокрутке, не прыгает
  await expect
    .poll(async () => (await stats(page))!.scroll)
    .toBeGreaterThan(1100);
  await expect
    .poll(async () => (await stats(page))!.frames)
    .toBeGreaterThan(before.frames + 10);
});

test("при «уменьшить движение» холст статичен", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/soroca");
  await waitForCanvas(page);
  const first = (await stats(page))!;
  expect(first.reducedMotion).toBe(true);
  expect(first.running).toBe(false);

  await page.evaluate(() => window.scrollTo(0, 1500));
  await page.waitForTimeout(600);
  const after = (await stats(page))!;
  // Кадр нарисован один раз, цикл стоит, слои получают scroll = 0
  expect(after.frames).toBe(first.frames);
  expect(after.scroll).toBe(0);
});

test("движок стоит, пока открыт лист блюда", async ({ page }) => {
  await page.goto("/soroca");
  await waitForCanvas(page);
  await page
    .getByRole("button", { name: "Kebab XL / XXL", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Kebab XL / XXL" }),
  ).toBeVisible();

  await expect.poll(async () => (await stats(page))!.paused).toContain("sheet");
  const frozen = (await stats(page))!;
  expect(frozen.running).toBe(false);
  await page.waitForTimeout(500);
  expect((await stats(page))!.frames).toBe(frozen.frames);

  await page.keyboard.press("Escape");
  await expect.poll(async () => (await stats(page))!.running).toBe(true);
});

test("движок стоит, пока открыта корзина", async ({ page }) => {
  await seedCart(page);
  await page.goto("/soroca");
  await waitForCanvas(page);
  await page.locator(".cart-bar").getByRole("button").click();
  await expect(page.getByRole("dialog", { name: "Coș" })).toBeVisible();

  await expect.poll(async () => (await stats(page))!.paused).toContain("cart");
  const frozen = (await stats(page))!;
  await page.waitForTimeout(500);
  expect((await stats(page))!.frames).toBe(frozen.frames);
});

test("движок стоит, пока страница едет к категории", async ({ page }) => {
  await page.goto("/soroca");
  await waitForCanvas(page);
  await page
    .getByRole("navigation", { name: /Categorii|Категории/ })
    .getByRole("link", { name: "Burgers" })
    .click();
  await expect
    .poll(async () => (await stats(page))!.paused)
    .toContain("scroll");
  // Прокрутка кончилась — движок снова идёт
  await expect
    .poll(async () => (await stats(page))!.paused, { timeout: 5000 })
    .not.toContain("scroll");
  await expect.poll(async () => (await stats(page))!.running).toBe(true);
});

test("спрятанная вкладка останавливает движок", async ({ page }) => {
  await page.goto("/soroca");
  await waitForCanvas(page);
  // Playwright не умеет прятать вкладку — подменяем видимость и шлём событие
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(async () => (await stats(page))!.paused)
    .toContain("hidden");
  expect((await stats(page))!.running).toBe(false);
});

test("на медленном устройстве движок сам понижает качество", async ({
  page,
  context,
}) => {
  // Замедляем главный поток. В эмуляторе замедляется только он (рисует
  // всё равно видеокарта хозяйской машины), поэтому 4× для честного падения
  // кадров мало — берём 8×. На настоящем слабом телефоне медленны оба.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
  await page.goto("/soroca");
  await waitForCanvas(page);
  // Проверяем то, за что отвечает движок: качество упало и запомнилось.
  //
  // Насколько именно упало — не проверяем. Движок меряет ровно два окна по
  // секунде и за окно опускается на одну ступень, поэтому уровень 3 бывает,
  // только если медленными окажутся оба окна. На компьютере разработчика
  // торможение замедляет главный поток, а рисует всё равно видеокарта:
  // после первой ступени кадров снова хватает, и второго понижения нет —
  // и это правильное поведение. Ожидание «3 и ниже» роняло тест через раз.
  await expect
    .poll(async () => (await stats(page))!.quality, { timeout: 30_000 })
    .toBeGreaterThan(1);
  const quality = (await stats(page))!.quality;
  const level = await page.evaluate(() =>
    window.sessionStorage.getItem("apetit.motion.quality"),
  );
  // Уровень остаётся на время визита (sessionStorage) и сам не повышается
  expect(Number(level)).toBe(quality);
  await page.goto("/briceni");
  await waitForCanvas(page);
  expect((await stats(page))!.quality).toBeGreaterThanOrEqual(quality);
});
