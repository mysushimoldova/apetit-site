import { expect, test } from "@playwright/test";

// Боевая сборка: инструментов разработчика на сайте нет, а фон есть.

test("панели /dev/motion в боевой сборке нет", async ({ page }) => {
  const response = await page.goto("/dev/motion");
  expect(response?.status()).toBe(404);
});

test("макета /dev/og в боевой сборке нет", async ({ page }) => {
  expect((await page.goto("/dev/og"))?.status()).toBe(404);
  expect((await page.goto("/dev/og?city=soroca"))?.status()).toBe(404);
});

test("маршрута /api/dev/motion в боевой сборке нет", async ({ request }) => {
  expect((await request.get("/api/dev/motion")).status()).toBe(404);
  const post = await request.post("/api/dev/motion", {
    data: { background: { mode: "static" } },
  });
  expect(post.status()).toBe(404);
});

test("движок показаний о себе не выдаёт", async ({ page }) => {
  await page.goto("/soroca");
  await page.locator("canvas.motion-canvas[data-ready]").waitFor({
    state: "attached",
  });
  const debug = await page.evaluate(
    () =>
      typeof (window as unknown as { __apetitMotion?: unknown }).__apetitMotion,
  );
  expect(debug).toBe("undefined");
});

test("сайт не даёт вставлять себя в чужую рамку", async ({ request }) => {
  const response = await request.get("/soroca");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
});

// Проверка тестового режима — тоже инструмент разработчика: в боевой сборке
// её нет ни с каким заголовком. Иначе появился бы способ узнать, что сервер
// принимает «тестовые» заказы, невидимые для точки и владельца.
test("маршрута /api/dev/e2e в боевой сборке нет", async ({ request }) => {
  expect((await request.get("/api/dev/e2e")).status()).toBe(404);
  const withHeader = await request.get("/api/dev/e2e", {
    headers: { "x-apetit-test": "любой" },
  });
  expect(withHeader.status()).toBe(404);
});
