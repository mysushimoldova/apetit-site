// Матрица браузеров: один набор проверок (e2e/matrix) прогоняется на восьми
// профилях — четыре телефона и четыре десктопа, три движка (Chromium = Chrome
// и Android Chrome, WebKit = Safari и iOS Safari, Gecko = Firefox).
// Запуск: npm run test:matrix
//
// Зачем отдельный конфиг, а не проекты в playwright.config.ts: обычный прогон
// (npm run test:e2e) должен оставаться быстрым — один телефон. Матрица тяжёлая,
// её гоняют перед сдачей задачи с интерфейсом.
//
// Сервер — тот же dev-сервер с APETIT_E2E=1, что и в основном конфиге: без
// этой переменной не работает тестовое время («точка закрыта») и заказы ушли
// бы в настоящий Telegram. reuseExistingServer: false — если на 3000 уже висит
// чужой `npm run dev`, Playwright честно упадёт, а не прогонит матрицу мимо
// нужных переменных окружения.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

/** Телефон: палец вместо мыши, мобильная вёрстка. */
const touch = { hasTouch: true, isMobile: true } as const;

export default defineConfig({
  testDir: "./e2e/matrix",
  // Dev-сервер Next 16 отвечает 500 на одновременные ПЕРВЫЕ запросы к ещё не
  // скомпилированному динамическому маршруту (см. playwright.config.ts)
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Телефонный WebKit на Windows медленнее Chromium в разы
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: "test-results/matrix",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    // ---------- Телефоны ----------
    {
      // iPhone 14 — самый ходовой iPhone. Движок WebKit = настоящий Safari.
      // viewport в описании устройства — 390×664 (с адресной строкой); берём
      // полную высоту экрана 844, а «адресную строку» проверяем отдельным
      // тестом на 660 (e2e/matrix/ios.spec.ts).
      name: "iphone-14",
      use: {
        ...devices["iPhone 14"],
        ...touch,
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
      },
    },
    {
      // Самый узкий экран, который надо держать: 375×667.
      name: "iphone-se",
      use: {
        ...devices["iPhone SE"],
        ...touch,
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
      },
    },
    {
      // Android Chrome. deviceScaleFactor 2.625 — настоящее значение Pixel 7.
      name: "pixel-7",
      use: { ...devices["Pixel 7"], ...touch },
    },
    {
      // Узкий Android (Samsung A-серии) — 360 CSS-px, самая частая ширина.
      name: "android-360",
      use: {
        ...devices["Pixel 7"],
        ...touch,
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 3,
      },
    },
    // ---------- Компьютеры ----------
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "desktop-chrome-wide",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "desktop-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "desktop-safari",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    env: { APETIT_E2E: "1" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
