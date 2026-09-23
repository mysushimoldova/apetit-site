import { expect, test, type Page } from "@playwright/test";

// Карточки блюд: мягкая тень под фото, появление при первой прокрутке и
// подъём при прокрутке (DESIGN.md → Food Image, Product Tile, Motion).
// Эталон поведения — docs/motion/produse-demo.html.

/** Все плитки меню с их состоянием появления. */
function tiles(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-reveal]")).map((tile) => {
      const photo = getComputedStyle(tile.querySelector(".food-reveal")!);
      // У блюда без фото тени нет: там Sand-плитка, а не вырезка
      const shadowEl = tile.querySelector(".food-shadow");
      const shadow = shadowEl ? getComputedStyle(shadowEl) : null;
      const rect = tile.getBoundingClientRect();
      return {
        visible: tile.hasAttribute("data-visible"),
        onScreen: rect.top >= 0 && rect.bottom <= window.innerHeight,
        photoOpacity: photo.opacity,
        photoTransform: photo.transform,
        shadowOpacity: shadow?.opacity ?? null,
        shadowTransform: shadow?.transform ?? null,
      };
    }),
  );
}

/** Фото первого экрана загружены — иначе плитки ещё без размеров. */
async function openMenu(page: Page) {
  await page.goto("/soroca");
  await page.locator("main img").first().waitFor();
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await expect
    .poll(async () =>
      page.locator("[data-reveal][data-visible]").first().isVisible(),
    )
    .toBe(true);
}

test("карточки первого экрана показаны сразу, без анимации", async ({
  page,
}) => {
  await openMenu(page);
  const list = await tiles(page);
  expect(list.length).toBeGreaterThan(10);
  const first = list.filter((tile) => tile.visible);
  expect(first.length).toBeGreaterThan(0);
  for (const tile of first) {
    expect(tile.photoOpacity).toBe("1");
    expect(tile.photoTransform).toBe("none");
    if (tile.shadowOpacity !== null) {
      expect(tile.shadowOpacity).toBe("1");
      expect(tile.shadowTransform).toBe("none");
    }
  }
  // Те, что ниже экрана, ждут своей очереди: фото спрятано и сдвинуто вниз
  const waiting = list.filter((tile) => !tile.visible);
  expect(waiting.length).toBeGreaterThan(0);
  expect(waiting[0].photoOpacity).toBe("0");
  expect(waiting[0].photoTransform).not.toBe("none");
});

test("под фото два слоя тени, обе без filter: blur", async ({ page }) => {
  await openMenu(page);
  const shadow = await page.evaluate(() => {
    const ambient = document.querySelector(".food-shadow-ambient")!;
    const contact = document.querySelector(".food-shadow-contact")!;
    const read = (el: Element) => {
      const style = getComputedStyle(el);
      return {
        width: Math.round(parseFloat(style.width)),
        height: Math.round(parseFloat(style.height)),
        opacity: style.opacity,
        filter: style.filter,
        image: style.backgroundImage.slice(0, 16),
      };
    };
    return { ambient: read(ambient), contact: read(contact) };
  });
  // Коробка градиента = эллипс + 1.5·размытие с каждой стороны
  expect(shadow.ambient.height).toBe(29 + 3 * 34);
  expect(shadow.contact.height).toBe(18 + 3 * 13);
  expect(shadow.ambient.opacity).toBe("0.11");
  expect(shadow.contact.opacity).toBe("0.29");
  for (const layer of [shadow.ambient, shadow.contact]) {
    expect(layer.filter).toBe("none");
    expect(layer.image).toContain("radial-gradient");
  }
});

test("тень не создаёт горизонтальной прокрутки", async ({ page }) => {
  await openMenu(page);
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(size.scrollWidth).toBe(size.clientWidth);
});

test("после прокрутки нижние карточки появились", async ({ page }) => {
  await openMenu(page);
  await page.evaluate(() =>
    window.scrollTo({ top: 2400, behavior: "instant" }),
  );
  // Появление — 360 мс плюс задержка колонок
  await expect
    .poll(async () => (await tiles(page)).filter((t) => t.onScreen).length)
    .toBeGreaterThan(0);
  await expect
    .poll(
      async () =>
        (await tiles(page))
          .filter((tile) => tile.onScreen)
          .every(
            (tile) =>
              tile.visible &&
              tile.photoOpacity === "1" &&
              (tile.shadowTransform === null ||
                tile.shadowTransform === "none"),
          ),
      { timeout: 5000 },
    )
    .toBe(true);
  for (const tile of (await tiles(page)).filter((t) => t.onScreen)) {
    expect(tile.photoTransform).toBe("none");
    if (tile.shadowTransform !== null)
      expect(tile.shadowTransform).toBe("none");
  }
});

test("при прокрутке фото приподнимается и садится обратно", async ({
  page,
}) => {
  await openMenu(page);
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  const lifted = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll(".food-lift"))
        .map((el) => (el as HTMLElement).style.transform)
        .filter(Boolean),
    );

  await page.evaluate(() =>
    window.scrollTo({ top: 1600, behavior: "instant" }),
  );
  await expect.poll(async () => (await lifted()).length).toBeGreaterThan(0);
  expect((await lifted())[0]).toContain("translate3d");

  // Страница стоит — слой снимает всё, что написал
  await expect
    .poll(async () => (await lifted()).length, { timeout: 8000 })
    .toBe(0);
});

test("пока открыт лист блюда, подъёма нет", async ({ page }) => {
  await openMenu(page);
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  await page.evaluate(() =>
    window.scrollTo({ top: 1600, behavior: "instant" }),
  );
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          Array.from(document.querySelectorAll(".food-lift")).filter(
            (el) => (el as HTMLElement).style.transform,
          ).length,
      ),
    )
    .toBeGreaterThan(0);

  await page.getByRole("button", { name: "Kebab Cheese", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Kebab Cheese" }),
  ).toBeVisible();
  const still = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll(".food-lift")).filter(
        (el) => (el as HTMLElement).style.transform,
      ).length,
  );
  expect(still).toBe(0);
});

test("в листе блюда тень под фото есть", async ({ page }) => {
  await openMenu(page);
  await page.getByRole("button", { name: "Kebab Cheese", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Kebab Cheese" });
  await expect(sheet).toBeVisible();
  const shadow = await sheet.locator(".food-shadow-ambient").evaluate((el) => {
    const style = getComputedStyle(el);
    return { opacity: style.opacity, image: style.backgroundImage };
  });
  expect(shadow.opacity).toBe("0.11");
  expect(shadow.image).toContain("radial-gradient");
});

test("«уменьшить движение»: только проявление, без сдвигов", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMenu(page);
  const waiting = (await tiles(page)).filter((tile) => !tile.visible);
  expect(waiting.length).toBeGreaterThan(0);
  for (const tile of waiting) {
    expect(tile.photoOpacity).toBe("0");
    expect(tile.photoTransform).toBe("none");
    if (tile.shadowTransform !== null)
      expect(tile.shadowTransform).toBe("none");
  }

  await page.evaluate(() =>
    window.scrollTo({ top: 2400, behavior: "instant" }),
  );
  await page.waitForTimeout(600);
  const shown = (await tiles(page)).filter((tile) => tile.onScreen);
  expect(shown.length).toBeGreaterThan(0);
  for (const tile of shown) {
    expect(tile.photoOpacity).toBe("1");
    expect(tile.photoTransform).toBe("none");
  }
  // Подъём при прокрутке выключен вместе с движком
  const lifted = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll(".food-lift")).filter(
        (el) => (el as HTMLElement).style.transform,
      ).length,
  );
  expect(lifted).toBe(0);
});

test("при переходе к категории карточки показываются без анимации", async ({
  page,
}) => {
  await openMenu(page);
  await page
    .getByRole("navigation", { name: /Categorii|Категории/ })
    .getByRole("link", { name: "Salad" })
    .click();
  await expect
    .poll(async () => page.locator("[data-reveal][data-instant]").count())
    .toBeGreaterThan(0);
  // Показанные так карточки сразу на месте, без перехода
  const instant = await page.locator("[data-reveal][data-instant]").first();
  await expect(instant).toHaveAttribute("data-visible", "");
  const style = await instant.locator(".food-reveal").evaluate((el) => {
    const s = getComputedStyle(el);
    return { opacity: s.opacity, duration: s.transitionDuration };
  });
  expect(style.opacity).toBe("1");
  expect(style.duration).toBe("0s");
});
