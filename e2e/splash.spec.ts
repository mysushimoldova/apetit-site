import { expect, test, type Page } from "@playwright/test";
import { splashConfig } from "../src/config/motion";
import { SPLASH_VIDEOS } from "../src/motion/splash/catalog";

// Заставка категории (docs/motion/splash-prompt.md) на телефоне 390 px.
//
// Заставка есть у каждой категории: где снят ролик — играет ролик, где нет
// (pizza, menu, crispy, hot-dog) — та же заставка, но с вырезанным фото
// первого доступного в точке блюда. Блюдо всегда одно.
//
// Важная особенность: ни ролики, ни фото не грузятся при открытии сайта.
// Первое нажатие на категорию заставки не показывает — оно только ставит
// их в загрузку. Поэтому каждый тест сначала «прогревает» категорию.

const MENU = "/soroca";
const CATEGORY = "drinks";

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

function chip(page: Page, slug: string) {
  return page.locator(`.chips-row a[data-slug="${slug}"]`);
}

/** Открыть меню и дождаться движка. */
async function openMenu(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(MENU);
  await page.waitForLoadState("load");
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  return errors;
}

/** Первое нажатие — ролики грузятся; ждём и возвращаемся к первой категории. */
async function warmUp(page: Page, slug = CATEGORY): Promise<void> {
  await chip(page, slug).click();
  await page.waitForTimeout(4000);
  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);
}

test("первое нажатие — без заставки, второе — с заставкой; потом сетка на месте", async ({
  page,
}) => {
  const errors = await openMenu(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(400);
  expect(await splashOn(page), "первое нажатие — заставки нет").toBe(false);

  await page.waitForTimeout(4000);
  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "второе нажатие — заставка играет").toBe(true);
  await expect(page.locator(".splash[data-on]")).toHaveCount(1);
  await expect(page.locator(".splash-word")).toHaveText("Drinks");

  // Заставка уходит сама и оставляет страницу на выбранной категории
  await page.waitForTimeout(2000);
  expect(await splashOn(page)).toBe(false);
  const top = await page.evaluate(
    () => document.getElementById("drinks")!.getBoundingClientRect().top,
  );
  expect(Math.abs(top), "сетка категории — сразу под шапкой").toBeLessThan(140);

  // Ничего не вылезло вбок и никто не ругался
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test("касание в середине — заставка уходит сразу", async ({ page }) => {
  await openMenu(page);
  await warmUp(page);

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
  await warmUp(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(250);
  expect(await splashOn(page)).toBe(true);

  await page.goBack();
  await page.waitForTimeout(600);
  expect(await splashOn(page)).toBe(false);
  await expect(page).toHaveURL(/\/soroca/);
  await expect(page.locator(".chips-row")).toBeVisible();
});

test("«уменьшить движение» — заставки нет совсем", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMenu(page);

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(4000);
  await chip(page, "kebab").click();
  await page.waitForTimeout(800);
  await chip(page, CATEGORY).click();
  await page.waitForTimeout(400);
  expect(await splashOn(page)).toBe(false);
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

  await chip(page, CATEGORY).click();
  await page.waitForTimeout(1500);
  await chip(page, CATEGORY).click();
  await page.waitForTimeout(600);
  expect(await splashOn(page)).toBe(false);
  expect(requests, "ролики не запрашивались").toEqual([]);
});

test("ролики не грузятся при открытии страницы", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) requests.push(r.url());
  });
  await openMenu(page);
  await page.waitForTimeout(1500);
  expect(requests).toEqual([]);
});

// ---------------------------------------------------------------------------
// Категории без ролика: заставка из фото
// ---------------------------------------------------------------------------

/** Меню Briceni: там есть пицца (в Сороках её нет — point-products.ts). */
const PIZZA_MENU = "/briceni";

test("pizza: заставка с фото появилась и ушла", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

  const photos: string[] = [];
  page.on("request", (r) => {
    if (/\/img\/products\/pizza-/.test(r.url())) photos.push(r.url());
  });

  await page.goto(PIZZA_MENU);
  await page.waitForLoadState("load");
  await page
    .locator("canvas.motion-canvas[data-ready]")
    .waitFor({ state: "attached" });

  // Первое нажатие — фото только встаёт в загрузку, заставки нет
  await chip(page, "pizza").click();
  await page.waitForTimeout(400);
  expect(await splashOn(page), "первое нажатие — заставки нет").toBe(false);
  await page.waitForTimeout(2500);

  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);

  // Второе — заставка играет, и это фото, а не ролик: ни одного запроса
  // к /splash/ у категории без ролика быть не может
  await chip(page, "pizza").click();
  await page.waitForTimeout(250);
  expect(await splashOn(page), "второе нажатие — заставка играет").toBe(true);
  await expect(page.locator(".splash[data-on]")).toHaveCount(1);
  await expect(page.locator(".splash-word")).toHaveText("Pizza");
  expect(photos.length, "фото пиццы запрошено").toBeGreaterThan(0);

  // Уходит сама и оставляет страницу на выбранной категории
  await page.waitForTimeout(2000);
  expect(await splashOn(page), "заставка ушла").toBe(false);
  const top = await page.evaluate(
    () => document.getElementById("pizza")!.getBoundingClientRect().top,
  );
  expect(Math.abs(top), "сетка категории — сразу под шапкой").toBeLessThan(140);
  expect(errors).toEqual([]);
});

test("фото-заставка: ролики для такой категории не грузятся", async ({
  page,
}) => {
  const videos: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/splash/")) videos.push(r.url());
  });
  await page.goto(PIZZA_MENU);
  await page.waitForLoadState("load");
  for (let i = 0; i < 2; i++) {
    await chip(page, "pizza").click();
    await page.waitForTimeout(2500);
  }
  expect(videos, "у категории без ролика ролики не запрашиваются").toEqual([]);
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
  await chip(page, "hot-dog").click();
  await page.waitForTimeout(2500);
  await chip(page, "kebab").click();
  await page.waitForTimeout(1200);

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
 * Полная проверка одной категории: прогреть, сыграть, посмотреть на первые
 * кадры, дождаться ухода затуханием и увидеть сетку этой категории.
 */
async function checkCategory(page: Page, slug: string): Promise<void> {
  // Первое нажатие ставит ролик или фото в загрузку — заставки пока нет
  await chip(page, slug).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const videos = [
            ...document.querySelectorAll<HTMLVideoElement>(
              ".splash-videos video",
            ),
          ];
          return videos.every((v) => v.readyState === 4);
        }),
      { timeout: 30_000, message: `ролик категории ${slug} не загрузился` },
    )
    .toBe(true);
  // Фото грузится своим путём — ему хватает секунды
  await page.waitForTimeout(1000);

  // Второе — заставка обязана сыграть, и блюдо видно с первых кадров
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

test("заставка играет у каждой категории без ролика", async ({ page }) => {
  test.slow();
  const errors = await openMenu(page);

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
  await warmUp(page);

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
