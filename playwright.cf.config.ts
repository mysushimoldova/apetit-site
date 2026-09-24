// Прогон на сборке для Cloudflare Workers (OpenNext + wrangler dev).
// Проверяет то же, что и боевой прогон (e2e-prod), но в той среде, в
// которой сайт будет жить на самом деле: другой сервер, другой способ
// отдавать файлы, другие заголовки.
//
// Запуск: npm run test:e2e:cf. Аккаунт Cloudflare не нужен — wrangler
// поднимает Worker целиком на этой машине.
//
// Заказы здесь не отправляются намеренно: сборка боевая, а значит пометить
// заказ тестовым невозможно (src/server/orders/test-mode.ts) — любой заказ
// ушёл бы в настоящий Telegram. Путь «город → корзина → заказ» проверяет
// обычный прогон на dev-сервере.
import { defineConfig, devices } from "@playwright/test";

const PORT = 3110;
// Именно 127.0.0.1: wrangler слушает только его, а «localhost» на этой
// машине сначала пробует IPv6 и упирается в отказ.
const BASE_URL = `http://127.0.0.1:${PORT}`;

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
    // --env-file .env.local: ключи лежат в одном месте, второй файл с
    // секретами (.dev.vars) заводить не нужно.
    command: `npm run build:cf && npx wrangler dev --env-file .env.local --port ${PORT} --ip 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: false,
    // Сборка сайта плюс упаковка Worker — это долго
    timeout: 900_000,
  },
});
