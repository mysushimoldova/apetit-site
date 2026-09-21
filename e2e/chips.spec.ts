import { expect, test, type Page } from "@playwright/test";

// Лента чипов категорий (DESIGN.md → Category Chips): оборот иконки при
// нажатии и переход к категории.

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
