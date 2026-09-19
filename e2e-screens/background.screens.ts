import { test } from "@playwright/test";

// Фоновые линии в меню с разным отдалением (--bg-frame-w — ширина кадра на
// экране): 1 — 1600px, 2 — 1200px (выбран), 3 — 900px. Только телефон 390px.
// Запуск: npm run screens -- background --project=390
const VARIANTS = [
  { name: "1", frame: "1600px" },
  { name: "2", frame: "1200px" },
  { name: "3", frame: "900px" },
];

test("скриншоты отдаления фона меню", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "390", "только телефон");
  await page.goto("/soroca");
  await page.locator("main img").first().waitFor();
  // Фото первого экрана загружены, фон проявился
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.locator("[data-brand-bg][data-ready]").waitFor({ state: "attached" });
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });

  for (const v of VARIANTS) {
    await page.evaluate(
      (w) => document.documentElement.style.setProperty("--bg-frame-w", w),
      v.frame,
    );
    // Дать закончиться проявлению фона и появлению плиток
    await page.waitForTimeout(600);
    await page.screenshot({ path: `docs/screens/07-zoom-${v.name}-390.png` });
  }
});
