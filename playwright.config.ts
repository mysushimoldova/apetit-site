import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Один воркер: dev-сервер Next 16 при одновременных ПЕРВЫХ запросах к ещё не
  // скомпилированному динамическому маршруту иногда отвечает 500
  // («Unexpected end of JSON input» в generate-params). Последовательно — всегда
  // стабильно, а тестов мало, скорость не страдает.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Главный экран — телефон 390px (CLAUDE.md), поэтому проверяем мобильный профиль
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
