import { test } from "@playwright/test";

test("скриншот экрана городов", async ({ page }, testInfo) => {
  // Итоговое состояние без ожидания анимации входа
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: "Briceni" }).waitFor();
  // Значок «N» dev-режима Next — не часть сайта, в документации не нужен
  await page.addStyleTag({ content: "nextjs-portal { display: none }" });
  await page.screenshot({
    path: `docs/screens/01-orase-${testInfo.project.name}.png`,
    fullPage: false,
  });
});
