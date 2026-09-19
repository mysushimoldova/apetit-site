// Отдельный запуск для скриншотов в docs/screens — не входит в npm run test:e2e.
// Запуск: npm run screens
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "./e2e-screens",
  testMatch: /.*\.screens\.ts/,
  projects: [
    {
      name: "390",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "1280",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
