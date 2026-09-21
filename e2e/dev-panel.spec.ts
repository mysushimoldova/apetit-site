import { readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Frame, type Page } from "@playwright/test";

// Панель настройки движения — /dev/motion. Только разработка: слева
// ползунки, справа настоящая страница меню в рамке; «Сохранить»
// переписывает src/config/motion.json.

// Путь от корня проекта: тесты запускаются оттуда
const FILE = "src/config/motion.json";

// Панель — инструмент для компьютера: ползунки слева, телефон справа
test.use({ viewport: { width: 1280, height: 900 } });

interface Stats {
  running: boolean;
  paused: string[];
  reducedMotion: boolean;
}

type MotionWindow = Window & { __apetitMotion?: () => Stats };

const frameStats = (frame: Frame): Promise<Stats | null> =>
  frame.evaluate(
    () => (window as unknown as MotionWindow).__apetitMotion?.() ?? null,
  );

/** Страница меню внутри рамки, с уже работающим движком. */
async function preview(page: Page): Promise<Frame> {
  await page.goto("/dev/motion");
  const frame = page.frameLocator('iframe[title="Меню Сорок"]');
  await frame.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  const found = page.frames().find((f) => f.url().endsWith("/soroca"));
  expect(found, "страница меню открылась в рамке").toBeTruthy();
  return found!;
}

test("панель показывает меню Сорок и управляет фоном на ходу", async ({
  page,
}) => {
  const frame = await preview(page);
  await expect.poll(async () => (await frameStats(frame))?.running).toBe(true);

  // Режим «Не двигается»: фон берёт паузу себе, цикл кадров стоит
  await page.getByRole("button", { name: "Не двигается" }).click();
  await expect
    .poll(async () => (await frameStats(frame))!.paused)
    .toContain("background-static");
  expect((await frameStats(frame))!.running).toBe(false);

  await page.getByRole("button", { name: "Живые линии" }).click();
  await expect.poll(async () => (await frameStats(frame))!.running).toBe(true);

  // Галочка «уменьшить движение» — как системная настройка
  await page.getByRole("checkbox", { name: "Уменьшить движение" }).check();
  await expect
    .poll(async () => (await frameStats(frame))!.reducedMotion)
    .toBe(true);
  await page.getByRole("checkbox", { name: "Уменьшить движение" }).uncheck();
  await expect.poll(async () => (await frameStats(frame))!.running).toBe(true);

  // Страница сообщает панели кадры в секунду
  await expect
    .poll(async () => page.getByText("Кадров в секунду").isVisible())
    .toBe(true);
  await expect
    .poll(
      async () =>
        await page
          .locator("dd")
          .first()
          .textContent()
          .then((text) => text?.trim()),
      { timeout: 5000 },
    )
    .not.toBe("—");
});

test("«Сохранить» переписывает src/config/motion.json", async ({ page }) => {
  const before = readFileSync(FILE, "utf8");
  try {
    await preview(page);
    await page.getByRole("slider", { name: "Насыщенность" }).fill("0.7");
    await expect(page.getByText("Есть несохранённые изменения")).toBeVisible();

    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect
      .poll(() => JSON.parse(readFileSync(FILE, "utf8")).background.opacity, {
        timeout: 10_000,
      })
      .toBe(0.7);
    // Остальные значения не пострадали
    const saved = JSON.parse(readFileSync(FILE, "utf8"));
    const original = JSON.parse(before);
    expect(saved.background).toEqual({
      ...original.background,
      opacity: 0.7,
    });
  } finally {
    writeFileSync(FILE, before);
  }
});

test("маршрут настроек в разработке отдаёт текущий файл", async ({
  request,
}) => {
  const response = await request.get("/api/dev/motion");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual(JSON.parse(readFileSync(FILE, "utf8")));
});

test("маршрут настроек не принимает значения вне границ", async ({
  request,
}) => {
  const response = await request.post("/api/dev/motion", {
    data: { background: { mode: "live", scale: 99999 } },
  });
  expect(response.status()).toBe(400);
  // Файл не тронут
  expect(JSON.parse(readFileSync(FILE, "utf8")).background.scale).not.toBe(
    99999,
  );
});
