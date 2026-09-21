// Отдельный прогон на БОЕВОЙ сборке: проверяем то, что зависит от режима —
// панель /dev/motion и её маршрут в боевой сборке должны отвечать 404.
// Не входит в npm run test:e2e (там dev-сервер). Запуск: npm run test:e2e:prod
import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e-prod",
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: BASE_URL, trace: "on-first-retry" },
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
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    // Сборка сайта целиком — это долго
    timeout: 600_000,
  },
});
