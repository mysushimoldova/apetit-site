import { expect, test, type Page } from "@playwright/test";

// Качество фоновых линий (src/motion/layers/contours.ts). Линия должна
// выглядеть как напечатанная: одинаковой толщины везде, без разрывов.
// За это отвечают две вещи, которые здесь и проверяются:
//   1) холст рисуется в настоящую плотность точек экрана (потолок — тройная);
//   2) понижение качества упрощает поле (меньше волн), но НЕ уменьшает
//      разрешение холста — иначе линии сразу мылятся.

// Экран iPhone: 390 CSS-пикселей при тройной плотности точек
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

interface Stats {
  quality: number;
  layers: string[];
}

type MotionWindow = Window & { __apetitMotion?: () => Stats };

const stats = (page: Page): Promise<Stats | null> =>
  page.evaluate(
    () => (window as unknown as MotionWindow).__apetitMotion?.() ?? null,
  );

async function canvasSize(page: Page) {
  await page
    .locator("canvas.motion-canvas[data-ready]")
    .waitFor({ state: "attached" });
  return page.locator("canvas.motion-canvas").evaluate((el) => {
    const canvas = el as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return {
      width: canvas.width,
      height: canvas.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      dpr: window.devicePixelRatio,
    };
  });
}

test("холст рисуется в тройную плотность точек экрана", async ({ page }) => {
  await page.goto("/soroca");
  const size = await canvasSize(page);
  expect(size.dpr).toBe(3);
  // Ровно ширина в CSS-пикселях, умноженная на плотность
  expect(size.width).toBe(Math.round(size.cssWidth * 3));
  expect(size.height).toBe(Math.round(size.cssHeight * 3));
  expect(size.width).toBe(1170);
});

test("качество упало — холст остался прежнего размера", async ({
  page,
  context,
}) => {
  // Тормозим главный поток, чтобы движок сам опустил уровень качества
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 8 });
  await page.goto("/soroca");
  const before = await canvasSize(page);
  expect(before.width).toBe(1170);

  await expect
    .poll(async () => (await stats(page))?.quality, { timeout: 30_000 })
    .toBeGreaterThan(1);

  const after = await canvasSize(page);
  // Вот это и есть суть правки: экономим на волнах, а не на разрешении
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  expect(after.width).toBe(Math.round(after.cssWidth * 3));
});
