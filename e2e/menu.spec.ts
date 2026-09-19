import { expect, test, type Page } from "@playwright/test";

// Высота липкой шапки (56) + ленты чипов (46) = 102px — секция после клика по
// чипу должна встать сразу под ними (scroll-margin-top).
const STICKY = 102;

async function scrollThroughPage(page: Page) {
  // Прокрутить всю страницу, чтобы ленивые картинки успели запроситься
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
}

test("/soroca: 11 категорий без пиццы, шапка и чипы на месте", async ({
  page,
}) => {
  await page.goto("/soroca");
  await expect(page.getByRole("banner")).toContainText("APETIT");
  await expect(page.getByRole("banner")).toContainText("Soroca");
  const billboards = page.locator("main h2");
  await expect(billboards).toHaveCount(11);
  await expect(billboards).not.toContainText(["PIZZA"]);
  const names = await billboards.allInnerTexts();
  expect(names.map((n) => n.trim().toUpperCase())).not.toContain("PIZZA");
  expect(names[0].trim().toUpperCase()).toBe("KEBAB");
  await expect(page.getByRole("navigation").getByRole("link")).toHaveCount(11);
});

test("/briceni: пицца есть", async ({ page }) => {
  await page.goto("/briceni");
  const billboards = page.locator("main h2");
  await expect(billboards).toHaveCount(12);
  const names = await billboards.allInnerTexts();
  expect(names.map((n) => n.trim().toUpperCase())).toContain("PIZZA");
});

test("клик по чипу Burgers плавно скроллит к BURGERS и делает чип активным", async ({
  page,
}) => {
  await page.goto("/soroca");
  const chip = page
    .getByRole("navigation")
    .getByRole("link", { name: "Burgers" });
  await chip.click();
  const section = page.locator("#burgers");
  await expect
    .poll(async () => Math.round((await section.boundingBox())!.y), {
      timeout: 3000,
    })
    .toBeGreaterThanOrEqual(STICKY - 4);
  await expect
    .poll(async () => Math.round((await section.boundingBox())!.y))
    .toBeLessThanOrEqual(STICKY + 4);
  await expect(chip).toHaveAttribute("aria-current", "true");
});

/** Записывать каждый чип, который становится активным (aria-current). */
async function recordActiveChips(page: Page) {
  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { activeLog: string[] }).activeLog = log;
    const nav = document.querySelector("nav.chips-row")!;
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as HTMLElement;
        if (el.getAttribute("aria-current") === "true")
          log.push(el.dataset.slug!);
      }
    }).observe(nav, { subtree: true, attributeFilter: ["aria-current"] });
  });
}

const activeLog = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { activeLog: string[] }).activeLog,
  );

for (const slug of ["crispy", "desert"]) {
  test(`плавный переход к дальней категории (${slug}): промежуточные чипы не загораются`, async ({
    page,
  }) => {
    await page.goto("/soroca");
    await recordActiveChips(page);
    const chip = page.locator(`nav.chips-row [data-slug="${slug}"]`);
    await chip.click();
    // Дождаться конца плавной прокрутки: позиция перестала меняться
    await expect
      .poll(
        async () => {
          const a = await page.evaluate(() => window.scrollY);
          await page.waitForTimeout(300);
          return a === (await page.evaluate(() => window.scrollY));
        },
        { timeout: 5000 },
      )
      .toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(3000);
    await page.waitForTimeout(300);
    expect(await activeLog(page)).toEqual([slug]);
    await expect(chip).toHaveAttribute("aria-current", "true");
  });
}

test("если прокрутку к чипу прервать колесом — активна категория, где страница остановилась", async ({
  page,
}) => {
  await page.goto("/soroca");
  const chip = page.locator('nav.chips-row [data-slug="desert"]');
  await chip.click();
  await page.waitForTimeout(150);
  await page.mouse.move(195, 500);
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(800);
  const expected = await page.evaluate((line) => {
    const sections = Array.from(document.querySelectorAll("main section[id]"));
    return sections.find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= line && r.bottom > line;
    })?.id;
  }, STICKY + 2);
  expect(expected).toBeTruthy();
  expect(expected).not.toBe("desert");
  await expect(
    page.locator(`nav.chips-row [data-slug="${expected}"]`),
  ).toHaveAttribute("aria-current", "true");
});

test("все фото загружаются: нет битых img и нет 404 на /img/", async ({
  page,
}) => {
  const failed: string[] = [];
  page.on("response", (r) => {
    if (r.url().includes("/img/") && r.status() >= 400)
      failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("/briceni");
  await scrollThroughPage(page);
  await page.waitForLoadState("networkidle");
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => !(img.complete && img.naturalWidth > 0))
      .map((img) => img.currentSrc || img.src),
  );
  expect(broken).toEqual([]);
  expect(failed).toEqual([]);
  // На Briceni все блюда с фото, кроме супов (выключены везде): 50 − 3 = 47
  expect(await page.locator("main img").count()).toBe(47);
});

test("/otaci открывается на русском", async ({ page }) => {
  await page.goto("/otaci");
  await expect(page.locator("[lang='ru']").first()).toBeVisible();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Бургеры" }),
  ).toBeVisible();
  await expect(page.getByText("de la")).toHaveCount(0);
  await expect(page.getByText(/^от /).first()).toBeVisible();
});

for (const city of ["soroca", "otaci"]) {
  test(`${city}: слова-вывески в одну строку и во всю ширину контента`, async ({
    page,
  }) => {
    await page.goto(`/${city}`);
    await page.evaluate(() => document.fonts.ready);
    const words = await page.locator("main h2").evaluateAll((els) =>
      els.map((el) => {
        const section = el.parentElement!;
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        // Один прямоугольник на каждую строку текста
        const tops = new Set(
          Array.from(range.getClientRects()).map((r) => Math.round(r.top)),
        );
        return {
          word: el.textContent,
          lines: tops.size,
          fill: text.width / section.clientWidth,
        };
      }),
    );
    for (const w of words) {
      expect(w.lines, `${w.word}: строк`).toBe(1);
      expect(w.fill, `${w.word}: не шире контента`).toBeLessThanOrEqual(1);
      // На телефоне слово — почти во всю ширину (макет, вариант A)
      expect(w.fill, `${w.word}: заполняет ширину`).toBeGreaterThan(0.9);
    }
  });
}

test.describe("десктоп", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("первый чип на одной линии с контентом, 4 колонки плиток", async ({
    page,
  }) => {
    await page.goto("/soroca");
    const chip = page.getByRole("navigation").getByRole("link").first();
    const title = page.locator("main h2").first();
    const chipX = Math.round((await chip.boundingBox())!.x);
    const titleX = Math.round((await title.boundingBox())!.x);
    expect(chipX).toBe(titleX);
    const tiles = page.locator("#kebab article");
    const ys = await tiles.evaluateAll((els) =>
      els.map((e) => Math.round(e.getBoundingClientRect().top)),
    );
    expect(new Set(ys).size).toBe(1); // 4 кебаба в одном ряду
  });
});
