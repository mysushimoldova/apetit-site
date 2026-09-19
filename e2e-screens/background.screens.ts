import { test } from "@playwright/test";

// Фоновые линии в меню (сила A, --bg-lines-opacity 0.5) с разной толщиной.
// Толщина зашита в картинку, поэтому вариант — отдельная сборка:
//   py -3 scripts/bg-lines.py build docs/bg-frames/kadr-08s.png            # A1, ~1px
//   py -3 scripts/bg-lines.py build docs/bg-frames/kadr-08s.png --line 0.6 # A2, ~0.6px
// и затем BG_VARIANT=A1|A2 npm run screens -- background --project=390
const variant = process.env.BG_VARIANT ?? "A1";

test("скриншот фона меню", async ({ page }, testInfo) => {
  const width = testInfo.project.name;
  await page.goto("/soroca");
  await page.locator("main img").first().waitFor();
  // Фото первого экрана и картинка линий загружены
  await page.waitForFunction(() =>
    Array.from(document.images)
      .filter((img) => img.getBoundingClientRect().top < window.innerHeight)
      .every((img) => img.complete && img.naturalWidth > 0),
  );
  await page.evaluate(async () => {
    const img = new Image();
    img.src = "/img/bg/linii.webp";
    await img.decode();
  });
  // Значок «N» dev-режима Next — не часть сайта
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  // Дать анимации появления плиток закончиться
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `docs/screens/07-fundal-${variant}-${width}.png`,
  });
});
