import { expect, test, type Page } from "@playwright/test";
import { splashConfig } from "../src/config/motion";
import { SPLASH_VIDEOS } from "../src/motion/splash/catalog";

// Заставка категории (docs/motion/splash-prompt.md) на телефоне 390 px.
//
// Заставка есть у каждой категории: где снят ролик — играет ролик, где нет
// (pizza, menu, crispy, hot-dog) — та же заставка, но с вырезанным фото
// первого доступного в точке блюда. Блюдо всегда одно.
//
// Загрузка (решение архитектора 25.09.2026, B0): при открытии страницы ролики
// не грузятся. Через секунду после отрисовки меню ролики и фото всех
// категорий точки тихо догружаются по одному с низким приоритетом, а каждый
// ролик сразу доводится до первого кадра (вариант «б») — и заставка играет
// уже с первого нажатия. Поэтому тесты сначала ждут конца этой предзагрузки
// (waitPrefetched).

const MENU = "/soroca";
const CATEGORY = "drinks";
/** Вторая категория для смены заставки на ходу. */
const SECOND = "burgers";

/** Заставка на экране? */
const splashOn = (page: Page) =>
  page.evaluate(() => document.documentElement.hasAttribute("data-splash"));

/** Прозрачность кремового экрана заставки прямо сейчас: по ней видно, что
 *  уход — именно затухание. */
const screenAlpha = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".splash");
    const value = root?.style.getPropertyValue("--splash-screen-alpha") ?? "";
    return value === "" ? null : Number(value);
  });

/** Сдвиг заставки в процентах: при уходе затуханием он обязан остаться
 *  нулевым — заставка гаснет на месте, без шторки. */
const liftShare = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".splash");
    const value = root?.style.getPropertyValue("--splash-lift") ?? "";
    return value === "" ? null : Number.parseFloat(value);
  });

/** Где верх секции категории относительно окна. */
const sectionTop = (page: Page, slug: string) =>
  page.evaluate(
    (id) => document.getElementById(id)!.getBoundingClientRect().top,
    slug,
  );

function chip(page: Page, slug: string) {
  return page.locator(`.chips-row a[data-slug="${slug}"]`);
}

/** Открыть меню и дождаться движка. */
async function openMenu(page: Page, url = MENU): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForLoadState("load");
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  return errors;
}

/** Ролики, которые догрузит предзагрузка этой точки: по одному на категорию
 *  с роликом (в Сороках есть первое блюдо каждой такой категории). */
async function expectedVideos(page: Page): Promise<string[]> {
  const slugs = await page
    .locator(".chips-row a[data-slug]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-slug")),
    );
  return slugs.flatMap((slug) => {
    const first = slug ? SPLASH_VIDEOS[slug]?.[0] : undefined;
    return first ? [`/splash/${first}.mp4`] : [];
  });
}

/** Сколько роликов предзагрузка уже довела до первого кадра. */
const framedVideos = (page: Page) =>
  page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLVideoElement>(".splash-videos video"),
      ].filter((video) => video.readyState >= 2).length,
  );

/**
 * Дождаться конца тихой предзагрузки: все ролики точки скачаны и у каждого
 * есть первый кадр. Скачан — по сети: запись о загрузке появляется, когда
 * файл скачан целиком. Первый кадр — по самим <video>. Файлы идут по одному,
 * фото — первыми, так что «готовы все ролики» и значит «готово всё».
 */
async function waitPrefetched(page: Page): Promise<void> {
  const expected = await expectedVideos(page);
  try {
    await expect
      .poll(
        async () => ({
          downloaded: await page.evaluate(
            () =>
              performance
                .getEntriesByType("resource")
                .filter((entry) => entry.name.includes("/splash/")).length,
          ),
          framed: await framedVideos(page),
        }),
        {
          timeout: 30_000,
          message: "тихая предзагрузка роликов не закончилась",
        },
      )
      .toEqual({ downloaded: expected.length, framed: expected.length });
  } catch (error) {
    // Предзагрузка не стартует, если заставки быть не может (например,
    // движок на уровне 4). Чтобы при сбое причина была видна сразу —
    // состояние движка и сколько файлов вообще запрошено
    const state = await page.evaluate(() => ({
      engine: (
        window as unknown as { __apetitMotion?: () => unknown }
      ).__apetitMotion?.(),
      photos: performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.includes("/img/products/")).length,
      splashDom: document.querySelectorAll(".splash").length,
    }));
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${reason}\nсостояние: ${JSON.stringify(state)}`);
  }
}

test("ролики не в критическом пути: не в HTML, после load и LCP, тихо и по одному", async ({
  page,
}) => {
  // Приоритет запроса виден только протоколу отладки Chromium
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  const priorities: string[] = [];
  cdp.on("Network.requestWillBeSent", (event) => {
    if (event.request.url.includes("/splash/")) {
      priorities.push(event.request.initialPriority);
    }
  });

  const response = await page.goto(MENU);
  const html = (await response?.text()) ?? "";
  expect(html, "в HTML страницы (и в <head>) роликов нет").not.toContain(
    "/splash/",
  );
  await page.waitForLoadState("load");
  await waitPrefetched(page);

  const timing = await page.evaluate(async () => {
    const lcp = await new Promise<number>((resolve) => {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        resolve(entries[entries.length - 1]?.startTime ?? 0);
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const videos = performance
      .getEntriesByType("resource")
      .filter((entry): entry is PerformanceResourceTiming =>
        entry.name.includes("/splash/"),
      )
      .map((entry) => ({ start: entry.startTime, end: entry.responseEnd }))
      .sort((a, b) => a.start - b.start);
    const preload = document.querySelectorAll('link[href*="/splash/"]').length;
    return { lcp, load: nav.loadEventEnd, videos, preload };
  });

  expect(timing.preload, "никаких <link rel=preload> на ролики").toBe(0);
  expect(timing.lcp, "LCP случился").toBeGreaterThan(0);
  expect(timing.videos.length, "ролики догрузились").toBeGreaterThan(0);
  for (const video of timing.videos) {
    expect(video.start, "ролик — только после load").toBeGreaterThan(
      timing.load,
    );
    expect(video.start, "ролик — только после LCP").toBeGreaterThan(timing.lcp);
  }
  // По одному: следующий начинается, когда предыдущий уже скачан
  for (let i = 1; i < timing.videos.length; i++) {
    expect(timing.videos[i].start).toBeGreaterThanOrEqual(
      timing.videos[i - 1].end - 1,
    );
  }
  expect(priorities.length).toBe(timing.videos.length);
  expect(new Set(priorities), "приоритет загрузки — низкий").toEqual(
    new Set(["Low"]),
  );
});

// B0 (решение архитектора 25.09.2026): предзагрузка не ждёт простоя
// страницы. Линии фона рисуются каждый кадр, простоя почти нет — раньше за
// 30 с успевало скачаться 3 ролика из 8. Правило: все ролики точки скачаны
// не позже 5 с от открытия страницы, пока фон живой.
test("все ролики точки скачаны за 5 с, пока фон рисуется", async ({ page }) => {
  await openMenu(page);
  await waitPrefetched(page);
  const result = await page.evaluate(() => {
    const videos = performance
      .getEntriesByType("resource")
      .filter((entry): entry is PerformanceResourceTiming =>
        entry.name.includes("/splash/"),
      );
    const stats = (
      window as unknown as {
        __apetitMotion?: () => { running: boolean; quality: number };
      }
    ).__apetitMotion?.();
    return {
      count: videos.length,
      lastEnd: Math.max(...videos.map((entry) => entry.responseEnd)),
      running: stats?.running ?? false,
      quality: stats?.quality ?? 4,
    };
  });
  expect(result.running, "фон рисуется").toBe(true);
  expect(result.quality, "движок не остановлен").toBeLessThan(4);
  expect(result.count).toBe((await expectedVideos(page)).length);
  expect(
    result.lastEnd,
    "последний ролик скачан, мс от открытия",
  ).toBeLessThanOrEqual(5000);
});

test("по одному ролику на категорию точки — ровно тот, что сыграет", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(new URL(r.url()).pathname);
  });
  await openMenu(page);
  await waitPrefetched(page);

  const expected = await expectedVideos(page);
  expect(requests.sort()).toEqual(expected.sort());
});

// Вариант «б» (решение архитектора 25.09.2026). До касания у каждого ролика
// точки уже есть <video> с первым кадром. Программ видеокарты для заставки
// ещё нет: их собирает первое касание чипа (pointerdown), пока палец не
// отпущен. Само нажатие новых <video> не создаёт.
test("до касания ролики разобраны, программы — по касанию чипа", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as Window & { __programs?: number };
    w.__programs = 0;
    const original = WebGL2RenderingContext.prototype.createProgram;
    WebGL2RenderingContext.prototype.createProgram = function () {
      w.__programs = (w.__programs ?? 0) + 1;
      return original.call(this);
    };
  });
  const programs = () =>
    page.evaluate(
      () => (window as Window & { __programs?: number }).__programs ?? 0,
    );
  const errors = await openMenu(page);
  await waitPrefetched(page);
  await page.waitForTimeout(500);

  const expected = await expectedVideos(page);
  const videos = page.locator(".splash-videos video");
  expect(await videos.count(), "по <video> на каждый ролик точки").toBe(
    expected.length,
  );
  expect(
    await page.locator(".splash[data-on]").count(),
    "заставка скрыта",
  ).toBe(0);
  const before = await programs();

  // Палец на чипе и ещё не отпущен: программы уже собраны, заставки ещё нет
  const target = chip(page, CATEGORY);
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // Две программы заставки: блюдо и пре-проход калибровки
  expect((await programs()) - before, "программы — по касанию").toBe(2);
  expect(await splashOn(page), "до отпускания заставки нет").toBe(false);
  await page.mouse.up();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "первое нажатие — заставка играет").toBe(true);
  expect(await videos.count(), "нажатие новых <video> не делает").toBe(
    expected.length,
  );
  expect((await programs()) - before).toBe(2);

  await expect
    .poll(() => splashOn(page), { timeout: 5000, message: "заставка не ушла" })
    .toBe(false);
  await chip(page, SECOND).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);
  // Вторая категория — тот же запас роликов; программы уже собраны
  expect(await videos.count()).toBe(expected.length);
  expect((await programs()) - before).toBe(2);
  expect(errors).toEqual([]);
});

test("первое же нажатие — с заставкой; потом сетка на месте", async ({
  page,
}) => {
  const errors = await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "первое нажатие — заставка играет").toBe(true);
  await expect(page.locator(".splash[data-on]")).toHaveCount(1);
  await expect(page.locator(".splash-word")).toHaveText("Drinks");

  // Заставка уходит сама и оставляет страницу на выбранной категории
  await page.waitForTimeout(2000);
  expect(await splashOn(page)).toBe(false);
  expect(
    Math.abs(await sectionTop(page, CATEGORY)),
    "сетка категории — сразу под шапкой",
  ).toBeLessThan(140);

  // Ничего не вылезло вбок и никто не ругался
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("ролик ещё грузится — ждём не дольше 150 мс, потом обычный переход", async ({
  page,
}) => {
  // Ролики отвечают очень медленно: за 150 мс не успеет ни один
  await page.route("**/splash/*.mp4", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await route.continue().catch(() => {});
  });
  const errors = await openMenu(page);
  const before = await page.evaluate(() => window.scrollY);

  await chip(page, CATEGORY).click();
  // Всё время ожидания и после него заставка так и не появилась
  const seen = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const t0 = performance.now();
        let on = false;
        const tick = () => {
          on ||= document.documentElement.hasAttribute("data-splash");
          if (performance.now() - t0 < 600) requestAnimationFrame(tick);
          else resolve(on);
        };
        tick();
      }),
  );
  expect(seen, "заставки не было").toBe(false);
  // А переход был — обычный, плавный
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await expect
    .poll(() => sectionTop(page, CATEGORY), { timeout: 4000 })
    .toBeLessThan(140);
  expect(errors).toEqual([]);
});

test("касание, и через 100 мс — другой чип: вторая категория со своей заставкой", async ({
  page,
}) => {
  const errors = await openMenu(page);
  await waitPrefetched(page);
  const historyBefore = await page.evaluate(() => history.length);
  const word = (await chip(page, SECOND).innerText()).trim();

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  // Касание в середине: заставка уходит и с этого же мига пропускает
  // касания насквозь — лента категорий под ней доступна
  await page.mouse.click(195, 420);
  await expect(page.locator(".splash[data-leaving]")).toHaveCount(1);
  await expect.poll(() => screenAlpha(page), { timeout: 400 }).toBeLessThan(1);

  // Ещё во время ухода — настоящее нажатие пальцем на другой чип
  await page.waitForTimeout(100);
  expect(await splashOn(page), "уход ещё идёт").toBe(true);
  await chip(page, SECOND).click();

  // Старая оборвалась, новая играет с начала: экран снова непрозрачный,
  // слово — второй категории, ухода нет
  await expect(page.locator(".splash-word")).toHaveText(word);
  await expect(page.locator(".splash[data-leaving]")).toHaveCount(0);
  expect(await screenAlpha(page)).toBe(1);
  const paint = await splashPaint(page);
  expect(paint.painted, "вторая заставка нарисована").toBeGreaterThan(0.03);

  // Сыграла до конца, ушла сама, страница — на второй категории
  await expect
    .poll(() => splashOn(page), { timeout: 5000, message: "заставка не ушла" })
    .toBe(false);
  expect(Math.abs(await sectionTop(page, SECOND))).toBeLessThan(140);
  // История: одна временная запись на всю череду заставок, как у одной
  expect(
    (await page.evaluate(() => history.length)) - historyBefore,
  ).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test("два нажатия подряд через 300 мс (с клавиатуры): текущая обрывается сразу", async ({
  page,
}) => {
  const errors = await openMenu(page);
  await waitPrefetched(page);
  const word = (await chip(page, SECOND).innerText()).trim();

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(300);
  expect(await splashOn(page)).toBe(true);
  await expect(page.locator(".splash-word")).toHaveText("Drinks");

  // Заставка закрывает ленту для пальца, но не для клавиатуры
  await chip(page, SECOND).focus();
  await page.keyboard.press("Enter");

  // Без ухода: в тот же миг — слово второй категории на непрозрачном экране
  await expect(page.locator(".splash-word")).toHaveText(word);
  await expect(page.locator(".splash[data-leaving]")).toHaveCount(0);
  expect(await screenAlpha(page)).toBe(1);

  await expect
    .poll(() => splashOn(page), { timeout: 5000, message: "заставка не ушла" })
    .toBe(false);
  expect(Math.abs(await sectionTop(page, SECOND))).toBeLessThan(140);
  expect(errors).toEqual([]);
});

test("после смены заставки «назад» закрывает новую, а не уводит со страницы", async ({
  page,
}) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(300);
  await chip(page, SECOND).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  expect(await splashOn(page)).toBe(true);

  // Запись в истории одна на всю череду и перешла ко второй заставке
  await page.goBack();
  await expect.poll(() => splashOn(page), { timeout: 1500 }).toBe(false);
  await expect(page).toHaveURL(/\/soroca/);
  await expect(page.locator(".chips-row")).toBeVisible();
});

test("касание в середине — заставка уходит сразу", async ({ page }) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  await page.locator(".splash").click({ position: { x: 195, y: 420 } });
  // Уход начался в тот же миг: экран уже гаснет, хотя показ должен был
  // держаться ещё три четверти секунды
  await expect
    .poll(() => screenAlpha(page), {
      timeout: 400,
      message: "касание запустило уход сразу",
    })
    .toBeLessThan(1);
  // Уход после касания — 500 мс. Сама по себе заставка жила бы 1000 + 500,
  // и мы касаемся её на 250-й миллисекунде: уложиться в 800 мс она может
  // только потому, что касание и правда прервало показ.
  await expect
    .poll(() => splashOn(page), {
      timeout: 1500,
      message: "после касания заставка обязана уйти сразу",
    })
    .toBe(false);
});

test("кнопка «назад» закрывает заставку, а не уводит со страницы", async ({
  page,
}) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  await page.goBack();
  await page.waitForTimeout(600);
  expect(await splashOn(page)).toBe(false);
  await expect(page).toHaveURL(/\/soroca/);
  await expect(page.locator(".chips-row")).toBeVisible();
});

// Адрес после заставки — как после обычного нажатия на чип: #категория
// остаётся, обновление страницы и ссылка открывают её. Своя запись заставки
// в истории не должна уносить метку с собой.
test("после заставки в адресе #категория, обновление открывает её же", async ({
  page,
}) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);
  await expect
    .poll(() => splashOn(page), { timeout: 5000, message: "заставка не ушла" })
    .toBe(false);
  await expect(page).toHaveURL(new RegExp(`/soroca#${CATEGORY}$`));

  await page.reload();
  await page.waitForLoadState("load");
  await expect(page).toHaveURL(new RegExp(`/soroca#${CATEGORY}$`));
  await expect(chip(page, CATEGORY)).toHaveAttribute("aria-current", "true");
  expect(Math.abs(await sectionTop(page, CATEGORY))).toBeLessThan(140);
});

test("смена заставки на ходу: в адресе вторая категория", async ({ page }) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(300);
  await chip(page, SECOND).focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => splashOn(page), { timeout: 5000, message: "заставка не ушла" })
    .toBe(false);
  await expect(page).toHaveURL(new RegExp(`/soroca#${SECOND}$`));
});

test("«назад» закрыл заставку — страница и адрес остались на категории", async ({
  page,
}) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);
  await page.goBack();
  await expect.poll(() => splashOn(page), { timeout: 1500 }).toBe(false);
  await expect(page).toHaveURL(new RegExp(`/soroca#${CATEGORY}$`));
  expect(Math.abs(await sectionTop(page, CATEGORY))).toBeLessThan(140);
});

test("«уменьшить движение» — заставки нет и ролики не грузятся", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(r.url());
  });
  await openMenu(page);
  await page.waitForTimeout(3000);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(400);
  expect(await splashOn(page)).toBe(false);
  expect(requests, "ролики не запрашивались").toEqual([]);
});

test("экономия трафика — заставки нет и ролики не грузятся", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true, effectiveType: "4g" },
    });
  });
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(r.url());
  });
  await openMenu(page);
  // Меню давно отрисовано — предзагрузки всё равно нет
  await page.waitForTimeout(3000);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(600);
  expect(await splashOn(page)).toBe(false);
  expect(requests, "ролики не запрашивались").toEqual([]);
});

test("сеть 2g — ролики не грузятся", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: false, effectiveType: "2g" },
    });
  });
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(r.url());
  });
  await openMenu(page);
  await page.waitForTimeout(3000);
  expect(requests).toEqual([]);
});

// ---------------------------------------------------------------------------
// Категории без ролика: заставка из фото
// ---------------------------------------------------------------------------

/** Меню Briceni: там есть пицца (в Сороках её нет — point-products.ts). */
const PIZZA_MENU = "/briceni";

test("pizza: заставка с фото играет с первого нажатия и уходит", async ({
  page,
}) => {
  const photos: string[] = [];
  page.on("request", (r) => {
    if (/\/img\/products\/pizza-/.test(r.url())) photos.push(r.url());
  });
  const errors = await openMenu(page, PIZZA_MENU);
  await waitPrefetched(page);
  expect(photos.length, "фото пиццы догружено заранее").toBeGreaterThan(0);

  // Первое же нажатие — заставка играет, и это фото, а не ролик: ролика
  // у пиццы нет, и среди роликов на странице его тоже нет
  await chip(page, "pizza").click();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "первое нажатие — заставка играет").toBe(true);
  await expect(page.locator(".splash[data-on]")).toHaveCount(1);
  await expect(page.locator(".splash-word")).toHaveText("Pizza");
  const videoSources = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLVideoElement>(".splash-videos video")]
      .map((v) => v.currentSrc)
      .filter((src) => src.includes("pizza")),
  );
  expect(videoSources).toEqual([]);

  // Уходит сама и оставляет страницу на выбранной категории
  await page.waitForTimeout(2000);
  expect(await splashOn(page), "заставка ушла").toBe(false);
  expect(
    Math.abs(await sectionTop(page, "pizza")),
    "сетка категории — сразу под шапкой",
  ).toBeLessThan(140);
  expect(errors).toEqual([]);
});

test("фото-заставка при «уменьшить движение» — заставки нет", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PIZZA_MENU);
  await page.waitForLoadState("load");
  for (let i = 0; i < 2; i++) {
    await chip(page, "pizza").click();
    await page.waitForTimeout(2500);
  }
  expect(await splashOn(page)).toBe(false);
});

test("hot-dog: ролика нет, фото есть — заставка играет", async ({ page }) => {
  const errors = await openMenu(page);
  await waitPrefetched(page);

  await chip(page, "hot-dog").click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);
  await page.waitForTimeout(2000);
  expect(await splashOn(page)).toBe(false);
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------------------
// Все категории: заставка появилась, блюдо видно с первого кадра, ушла
// ---------------------------------------------------------------------------
//
// Одной категории мало: именно поэтому и пропустили баг, из-за которого на
// телефоне заставку показывала только категория с фото, а у категорий с
// роликом оставался пустой кремовый экран (ролик считался готовым, когда у
// него был расшифрован один кадр). Здесь проверяется КАЖДАЯ категория —
// и те, у которых ролик есть, и те, где играет фото.

/**
 * Что нарисовано на экране во время заставки. Скриншот декодирует сама
 * страница: так проекту не нужен ни один новый пакет.
 *
 * painted — доля пикселей экрана, которые не кремовые и не чернильные:
 *   это и есть нарисованное (жёлтый круг и само блюдо). Слово категории —
 *   чернильный контур, оно в счёт не идёт. Пустой кремовый экран даёт ноль.
 * discYellow — доля полного жёлтого круга, оставшаяся видимой. Единица
 *   означает круг без блюда — тот самый «пустой экран» из жалобы хозяина.
 */
async function splashPaint(
  page: Page,
): Promise<{ painted: number; discYellow: number }> {
  const shot = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ data, disc }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(image, 0, 0);
      const { data: px } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let yellow = 0;
      let painted = 0;
      const total = px.length / 4;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        // Фирменный #FFBC0D с запасом на сглаживание и сжатие
        if (r > 230 && g > 155 && g < 215 && b < 90) yellow++;
        const ink = r < 70 && g < 70 && b < 70;
        const cream =
          Math.abs(r - 247) < 60 &&
          Math.abs(g - 242) < 60 &&
          Math.abs(b - 234) < 60;
        if (!ink && !cream) painted++;
      }
      // Полный круг: диаметр — доля ширины экрана из настроек (splash.disc.d0)
      const scale = canvas.width / window.innerWidth;
      const radius = (disc * window.innerWidth * scale) / 2;
      return {
        painted: painted / total,
        discYellow: yellow / (Math.PI * radius * radius),
      };
    },
    { data: shot, disc: splashConfig.disc.d0 },
  );
}

/**
 * Полная проверка одной категории: сыграть с первого нажатия, посмотреть на
 * первые кадры, дождаться ухода затуханием и увидеть сетку этой категории.
 * Предзагрузку тест ждёт заранее (waitPrefetched).
 */
async function checkCategory(page: Page, slug: string): Promise<void> {
  // Заставка обязана сыграть, и блюдо видно с первых кадров
  await chip(page, slug).click();
  await page.waitForTimeout(50);
  expect(await splashOn(page), `${slug}: заставка играет`).toBe(true);
  const paint = await splashPaint(page);
  expect(
    paint.painted,
    `${slug}: на первых кадрах нарисованы круг и блюдо`,
  ).toBeGreaterThan(0.03);
  expect(paint.discYellow, `${slug}: блюдо закрывает часть круга`).toBeLessThan(
    0.85,
  );

  // Уход — затухание: экран гаснет и никуда не едет
  await expect
    .poll(() => screenAlpha(page), {
      timeout: 4000,
      message: `${slug}: уход не начался`,
    })
    .toBeLessThan(1);
  expect(await liftShare(page), `${slug}: заставка уходит без сдвига`).toBe(0);

  await expect
    .poll(() => splashOn(page), {
      timeout: 5000,
      message: `${slug}: заставка не ушла`,
    })
    .toBe(false);

  // Сетка этой категории на месте
  await expect(page.locator(`#${slug} .tiles > *`).first()).toBeVisible();
}

/** Слаги категорий, у которых в проекте есть ролик. */
const VIDEO_CATEGORIES = Object.keys(SPLASH_VIDEOS);

test("заставка играет у каждой категории с роликом", async ({ page }) => {
  test.slow();
  const errors = await openMenu(page);
  await waitPrefetched(page);

  const present: string[] = [];
  for (const slug of VIDEO_CATEGORIES) {
    if (await chip(page, slug).count()) present.push(slug);
  }
  // Супы выключены во всех точках (src/data/menu/point-products.ts) — их
  // ролики играть негде; всё остальное обязано быть в меню Сорок.
  expect(present, "категории с роликом в меню").toEqual(
    VIDEO_CATEGORIES.filter((slug) => slug !== "supe"),
  );

  for (const slug of present) await checkCategory(page, slug);
  expect(errors).toEqual([]);
});

// Человек нажимает чип не сразу. Chrome примерно через 20–30 с простоя
// усыпляет стоящий ролик, а при нажатии будит и перечитывает его файл по
// адресу blob:. Когда адрес закрывали сразу после первого кадра (пункт B7),
// после 30–40 с простоя заставка шла без блюда (замер 25.09.2026: 5 прогонов из
// 5 красные, без закрытия — зелёные).
test("через 30 с простоя заставка по-прежнему с блюдом", async ({ page }) => {
  test.slow();
  const errors = await openMenu(page);
  await waitPrefetched(page);
  await page.waitForTimeout(30_000);

  for (const slug of VIDEO_CATEGORIES) {
    if (await chip(page, slug).count()) await checkCategory(page, slug);
  }
  expect(errors).toEqual([]);
});

test("заставка играет у каждой категории без ролика", async ({ page }) => {
  test.slow();
  const errors = await openMenu(page);
  await waitPrefetched(page);

  // Категории меню, у которых ролика нет: заставку им играет фото первого
  // блюда. Список берётся из самой страницы, а не из хардкода.
  const chips = await page.locator(".chips-row a[data-slug]").all();
  const present: string[] = [];
  for (const item of chips) {
    const slug = await item.getAttribute("data-slug");
    if (slug && !VIDEO_CATEGORIES.includes(slug)) present.push(slug);
  }
  expect(present.length, "в меню есть категории без ролика").toBeGreaterThan(0);

  for (const slug of present) await checkCategory(page, slug);
  expect(errors).toEqual([]);
});

test("прокрутка заблокирована ровно на время заставки", async ({ page }) => {
  await openMenu(page);
  await waitPrefetched(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  const before = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.scrollY), "во время заставки").toBe(
    before,
  );

  // Заставка ушла — прокрутка работает сразу, без «хвоста»
  await expect.poll(() => splashOn(page), { timeout: 5000 }).toBe(false);
  await page.mouse.wheel(0, 400);
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 2000 })
    .toBeGreaterThan(before);
});

// 25.09.2026: на iPhone в кадр заставки попали настройки старого вида, и
// кадр падал сотни раз в секунду — страница висла. Какой бы ни была ошибка,
// заставка обязана исчезнуть сразу и больше не мешать. Ломаем кадр нарочно:
// --splash-lift ставит только кадр заставки. Ломается либо самый первый кадр
// (он рисуется прямо при нажатии), либо третий — уже из обычного хода кадров.
for (const broken of [1, 3]) {
  test(`ошибка в кадре ${broken} заставки её мгновенно закрывает и не вешает страницу`, async ({
    page,
  }) => {
    const errors = await openMenu(page);
    await waitPrefetched(page);
    await page.evaluate((from) => {
      const own = CSSStyleDeclaration.prototype.setProperty;
      const trap = window as unknown as { __splashFrames: number };
      trap.__splashFrames = 0;
      CSSStyleDeclaration.prototype.setProperty = function (name, ...rest) {
        if (name === "--splash-lift") {
          trap.__splashFrames += 1;
          if (trap.__splashFrames >= from) {
            throw new TypeError("кадр заставки сломан тестом");
          }
        }
        return own.call(this, name, ...rest);
      };
    }, broken);
    const frames = () =>
      page.evaluate(
        () => (window as unknown as { __splashFrames: number }).__splashFrames,
      );

    await chip(page, CATEGORY).click();
    await page.waitForTimeout(500);

    // Кадр упал один раз, дальше кадры не планируются
    expect(await frames(), "кадров после ошибки").toBe(broken);
    expect(await splashOn(page), "заставка закрыта").toBe(false);
    await expect(page.locator(".splash[data-on]")).toHaveCount(0);
    const motion = await page.evaluate(
      () =>
        (
          window as unknown as { __apetitMotion?: () => { paused: string[] } }
        ).__apetitMotion?.() ?? null,
    );
    expect(motion!.paused, "движок снят с паузы").not.toContain("splash");

    // Страница на выбранной категории, и прокрутка своя
    await expect
      .poll(() => sectionTop(page, CATEGORY).then(Math.abs), { timeout: 3000 })
      .toBeLessThan(140);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 2000 })
      .toBeGreaterThan(before);

    // Следующий чип — обычный переход без заставки и без новых ошибок
    await chip(page, SECOND).click();
    await expect
      .poll(() => sectionTop(page, SECOND).then(Math.abs), { timeout: 3000 })
      .toBeLessThan(140);
    expect(await frames()).toBe(broken);
    expect(await splashOn(page)).toBe(false);

    // В консоли ровно одна запись, и это наша
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Заставка категории отключена");
  });
}
