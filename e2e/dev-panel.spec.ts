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

  // Режим «Не двигается»: стоит только время линий — движок продолжает
  // идти, чтобы фон по-прежнему ехал при прокрутке
  await page.getByRole("button", { name: "Не двигается" }).click();
  await expect(
    page.getByRole("button", { name: "Не двигается" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await frameStats(frame))!.running).toBe(true);
  expect((await frameStats(frame))!.paused).toEqual([]);

  await page.getByRole("button", { name: "Живые линии" }).click();
  await expect.poll(async () => (await frameStats(frame))!.running).toBe(true);

  // Галочка «уменьшить движение» — как системная настройка
  await page.getByRole("checkbox", { name: "Уменьшить движение" }).check();
  await expect
    .poll(async () => (await frameStats(frame))!.reducedMotion)
    .toBe(true);
  await page.getByRole("checkbox", { name: "Уменьшить движение" }).uncheck();
  await expect.poll(async () => (await frameStats(frame))!.running).toBe(true);

  // Цвет фона страницы виден в рамке сразу — и стекло шапки берёт его же
  await page.getByRole("button", { name: "D #F1E9DB" }).click();
  await expect
    .poll(() =>
      frame.evaluate(() =>
        document.documentElement.style.getPropertyValue("--color-cream"),
      ),
    )
    .toBe("#F1E9DB");
  expect(
    await frame.evaluate(
      () => getComputedStyle(document.querySelector("header")!).backgroundColor,
    ),
  ).toBe("rgba(241, 233, 219, 0.78)");
  await page.getByRole("button", { name: "A #FAF7F2" }).click();

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
    await page.getByRole("button", { name: "B #F7F2EA" }).click();
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
    // Цвет фона страницы сохраняется той же кнопкой
    expect(saved.page).toEqual({ background: "#F7F2EA" });
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
    data: { background: { mode: "live", tilesAcross: 99999 } },
  });
  expect(response.status()).toBe(400);
  // Файл не тронут
  expect(
    JSON.parse(readFileSync(FILE, "utf8")).background.tilesAcross,
  ).not.toBe(99999);
});

test("маршрут настроек не принимает запрос с чужого сайта", async ({
  request,
}) => {
  const before = readFileSync(FILE, "utf8");
  const response = await request.post("/api/dev/motion", {
    headers: { origin: "http://evil.example" },
    data: JSON.parse(before),
  });
  expect(response.status()).toBe(403);
  expect(readFileSync(FILE, "utf8")).toBe(before);
});
