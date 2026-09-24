import { expect, test, type Page } from "@playwright/test";

// Лента чипов категорий (DESIGN.md → Category Chips): переход к категории.
// Сами чипы не двигаются — ни иконка, ни подпись (docs/MOTION.md §4,
// решение архитектора 24.09.2026: оборот иконки убран совсем).

// Высота липкой шапки (56) + ленты чипов (46)
const STICKY = 102;

/** Запоминаем каждый вызов element.animate() внутри чипа: их быть не должно. */
async function recordChipAnimations(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __chipAnimations: unknown[] };
    w.__chipAnimations = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.closest(".chip")) {
        w.__chipAnimations.push({
          slug: this.closest(".chip")!.getAttribute("data-slug"),
          keyframes,
          options,
        });
      }
      return original.call(this, keyframes, options);
    };
  });
}

const chipAnimations = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __chipAnimations: unknown[] }).__chipAnimations,
  );

/** Чип и его иконка стоят на месте: никакого transform. */
async function expectChipStill(page: Page, slug: string) {
  const transforms = await page.evaluate((s) => {
    const chip = document.querySelector<HTMLElement>(`.chip[data-slug="${s}"]`);
    const icon = chip?.querySelector("svg");
    const read = (el: Element | null | undefined) =>
      el ? getComputedStyle(el).transform : "missing";
    return [read(chip), read(icon)];
  }, slug);
  for (const value of transforms) {
    expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(value);
  }
}

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

test("нажатие на чип: переход к категории, сам чип не шевелится", async ({
  page,
}) => {
  await recordChipAnimations(page);
  await page.goto("/soroca");
  await page
    .getByRole("navigation", { name: /Categorii|Категории/ })
    .getByRole("link", { name: "Burgers" })
    .click();
  await expectAtSection(page, "burgers");
  expect(await chipAnimations(page), "чип ничего не анимирует").toEqual([]);
  await expectChipStill(page, "burgers");
});

test("чип с клавиатуры: Enter и Space — переход без движения чипа", async ({
  page,
}) => {
  await recordChipAnimations(page);
  await page.goto("/soroca");
  const nav = page.getByRole("navigation", { name: /Categorii|Категории/ });
  await nav.getByRole("link", { name: "Burgers" }).focus();
  await page.keyboard.press("Enter");
  await expectAtSection(page, "burgers");
  await nav.getByRole("link", { name: "Crispy" }).focus();
  await page.keyboard.press("Space");
  await expectAtSection(page, "crispy");
  expect(await chipAnimations(page)).toEqual([]);
});

test("при «уменьшить движение» чип тоже не крутится, переход работает", async ({
  page,
}) => {
  await recordChipAnimations(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/soroca");
  await page
    .getByRole("navigation", { name: /Categorii|Категории/ })
    .getByRole("link", { name: "Burgers" })
    .click();
  await expectAtSection(page, "burgers");
  expect(await chipAnimations(page)).toEqual([]);
  await expectChipStill(page, "burgers");
});
