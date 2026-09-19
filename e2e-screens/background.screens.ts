import { test } from "@playwright/test";

// Фоновые линии в меню с разной силой (--bg-lines-opacity):
// A — 0.5, B — 0.8 (выбран), C — 1.0. На 1280 — только B.
const VARIANTS = [
  { name: "A", opacity: "0.5" },
  { name: "B", opacity: "0.8" },
  { name: "C", opacity: "1" },
];

test("скриншоты фона меню", async ({ page }, testInfo) => {
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

  for (const v of VARIANTS) {
    if (width === "1280" && v.name !== "B") continue;
    await page.evaluate(
      (o) =>
        document.documentElement.style.setProperty("--bg-lines-opacity", o),
      v.opacity,
    );
    // Дать анимации появления плиток закончиться
    await page.waitForTimeout(600);
    await page.screenshot({
      path: `docs/screens/07-fundal-${v.name}-${width}.png`,
    });
  }
});
