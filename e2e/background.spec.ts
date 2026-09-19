import { expect, test, type Page } from "@playwright/test";

// Фоновые линии бренда (DESIGN.md → Background) и оборот иконки чипа.

/** Вертикальный сдвиг ленты фона в px (из computed transform). */
async function layerShift(page: Page): Promise<number> {
  return page.evaluate(() => {
    const track = document.querySelector(".brand-bg-track")!;
    const t = getComputedStyle(track).transform;
    return t === "none" ? 0 : new DOMMatrixReadOnly(t).m42;
  });
}

for (const path of ["/", "/soroca", "/soroca/comanda"]) {
  test(`${path}: слой линий под контентом, клики проходят сквозь`, async ({
    page,
  }) => {
    await page.goto(path);
    const layer = page.locator("[data-brand-bg]");
    await expect(layer).toHaveCount(1);
    await expect(layer).toHaveAttribute("aria-hidden", "true");
    const style = await layer.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        position: s.position,
        zIndex: s.zIndex,
        pointerEvents: s.pointerEvents,
        opacity: s.opacity,
      };
    });
    expect(style).toEqual({
      position: "fixed",
      zIndex: "-1",
      pointerEvents: "none",
      opacity: "0.8",
    });
    // Картинка линий загрузилась
    await expect
      .poll(() =>
        page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .some((r) => r.name.endsWith("/img/bg/linii.webp")),
        ),
      )
      .toBe(true);
    // В центре экрана верхний элемент — контент или фон страницы, не слой
    const hitsLayer = await page.evaluate(() => {
      const el = document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2,
      );
      return !!el?.closest("[data-brand-bg]");
    });
    expect(hitsLayer).toBe(false);
  });
}

test("при прокрутке слой едет вверх на 0.35 от прокрутки", async ({ page }) => {
  await page.goto("/soroca");
  expect(await layerShift(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 1000));
  await expect.poll(() => layerShift(page)).toBeCloseTo(-350, 0);
});

test("при «уменьшить движение» слой неподвижен", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/soroca");
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(300);
  expect(await layerShift(page)).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(300);
  expect(await layerShift(page)).toBe(0);
});

// ---------- Оборот иконки чипа ----------

// Высота липкой шапки (56) + ленты чипов (46)
const STICKY = 102;

/** Запоминаем каждый вызов element.animate() на иконке чипа. */
async function recordSpins(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __spins: unknown[] };
    w.__spins = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.closest(".chip")) {
        w.__spins.push({
          slug: this.closest(".chip")!.getAttribute("data-slug"),
          keyframes,
          options,
        });
      }
      return original.call(this, keyframes, options);
    };
  });
}

type Spin = {
  slug: string;
  keyframes: { transform: string }[];
  options: { duration: number; easing: string };
};
const spins = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spins: Spin[] }).__spins);

async function expectAtSection(page: Page, slug: string) {
  const section = page.locator(`#${slug}`);
  await expect
    .poll(async () => Math.round((await section.boundingBox())!.y), {
      timeout: 4000,
    })
    .toBeGreaterThanOrEqual(STICKY - 4);
  await expect
    .poll(async () => Math.round((await section.boundingBox())!.y))
    .toBeLessThanOrEqual(STICKY + 4);
  await expect(page.locator(`.chip[data-slug="${slug}"]`)).toHaveAttribute(
    "aria-current",
    "true",
  );
}

test("нажатие на чип: один оборот иконки 250ms и переход к категории", async ({
  page,
}) => {
  await recordSpins(page);
  await page.goto("/soroca");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Burgers" })
    .click();
  const [spin, ...rest] = await spins(page);
  expect(rest).toHaveLength(0);
  expect(spin.slug).toBe("burgers");
  expect(spin.keyframes).toEqual([
    { transform: "rotate(0deg)" },
    { transform: "rotate(360deg)" },
  ]);
  expect(spin.options.duration).toBe(250);
  // --ease-out из DESIGN; браузер может записать 0.2 как .2
  expect(spin.options.easing.replace(/\b0\./g, ".")).toBe(
    "cubic-bezier(.2, .8, .2, 1)",
  );
  // Один раз: без повторов и бесконечности
  expect(spin.options).not.toHaveProperty("iterations");
  await expectAtSection(page, "burgers");
});

test("чип с клавиатуры: Enter и Space — тот же оборот и переход", async ({
  page,
}) => {
  await recordSpins(page);
  await page.goto("/soroca");
  const nav = page.getByRole("navigation");
  await nav.getByRole("link", { name: "Burgers" }).focus();
  await page.keyboard.press("Enter");
  await expectAtSection(page, "burgers");
  await nav.getByRole("link", { name: "Crispy" }).focus();
  await page.keyboard.press("Space");
  await expectAtSection(page, "crispy");
  expect((await spins(page)).map((s) => s.slug)).toEqual(["burgers", "crispy"]);
});

test("при «уменьшить движение» иконка не крутится, переход работает", async ({
  page,
}) => {
  await recordSpins(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/soroca");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Burgers" })
    .click();
  await expectAtSection(page, "burgers");
  expect(await spins(page)).toHaveLength(0);
});
