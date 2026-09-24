import { expect, test, type Locator, type Page } from "@playwright/test";

// Лист блюда и корзина (SPEC §3 шаги 3–4). Профиль — телефон 390px.

const cartBar = (page: Page) => page.locator(".cart-bar");

/** Отметить галочку/размер: вход скрыт (sr-only), нажимаем его подпись. */
async function pick(
  dialog: Locator,
  role: "radio" | "checkbox",
  name: string | RegExp,
) {
  // Вложенный локатор ищется внутри подписи — поэтому от page, не от листа
  const control = dialog.page().getByRole(role, { name, exact: true });
  await dialog.locator("label").filter({ has: control }).click();
}

async function openProduct(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
  const dialog = page.getByRole("dialog", { name });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.beforeEach(async ({ page }) => {
  // Рабочее время (12:00 в Кишинёве): «Comandă» активна
  await page.clock.setFixedTime(new Date("2026-09-19T09:00:00Z"));
  await page.goto("/soroca");
  // Корзина подставляется после загрузки — дождаться, пока «+» оживёт
  await page.waitForFunction(() => document.readyState === "complete");
});

test("сценарий задачи: Kebab XL/XXL → XXL + sos usturoi × 2 → 228 lei → корзина → удалить", async ({
  page,
}) => {
  const sheet = await openProduct(page, "Kebab XL / XXL");
  // По умолчанию — XL за 80
  await expect(
    sheet.getByRole("button", { name: "Adaugă · 80 lei" }),
  ).toBeVisible();

  await pick(sheet, "radio", "XXL");
  await expect(
    sheet.getByRole("radio", { name: "XXL", exact: true }),
  ).toBeChecked();
  await expect(sheet.getByText("430 g")).toBeVisible();
  await pick(sheet, "checkbox", /Sos de usturoi/);
  await sheet.getByRole("button", { name: "Mărește cantitatea" }).click();
  await expect(sheet.locator("output")).toHaveText("2");

  const add = sheet.getByRole("button", { name: "Adaugă · 228 lei" });
  await expect(add).toBeVisible();
  await add.click();
  await expect(sheet).toBeHidden();

  const bar = cartBar(page);
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("1 poziție");
  await expect(bar).toContainText("228 lei");
  // Бейдж — штуки
  await expect(bar.locator(".cart-badge")).toHaveText("2");

  await bar.getByRole("button").click();
  const cart = page.getByRole("dialog", { name: "Coș" });
  await expect(cart).toBeVisible();
  await expect(cart).toContainText("Kebab XL / XXL");
  await expect(cart).toContainText("XXL · Extra: Sos de usturoi");
  await expect(cart).toContainText("Total");
  await expect(cart.getByRole("link", { name: "Comandă" })).toHaveAttribute(
    "href",
    "/soroca/comanda",
  );

  await cart.getByRole("button", { name: "Șterge: Kebab XL / XXL" }).click();
  await expect(cart).toBeHidden();
  await expect(bar).toBeHidden();
});

test("«+» на плитке без размеров: добавляет без листа, счётчик, фокус не теряется", async ({
  page,
}) => {
  const plus = page.getByRole("button", { name: "Adaugă: Kebab Cheese" });
  await plus.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(plus).toBeFocused();

  const minus = page.getByRole("button", {
    name: "Scade cantitatea: Kebab Cheese",
  });
  await expect(minus).toBeVisible();
  await plus.click();
  await expect(cartBar(page)).toContainText("1 poziție");
  await expect(cartBar(page)).toContainText("210 lei");
  await expect(cartBar(page).locator(".cart-badge")).toHaveText("2");

  await minus.click();
  await minus.click();
  await expect(minus).toHaveCount(0);
  await expect(plus).toBeFocused();
  await expect(cartBar(page)).toBeHidden();
});

test("«+» у блюда с размерами открывает лист", async ({ page }) => {
  await page.getByRole("button", { name: "Adaugă: Kebab XL / XXL" }).click();
  await expect(
    page.getByRole("dialog", { name: "Kebab XL / XXL" }),
  ).toBeVisible();
});

test("«Fără» бесплатно, «Extra» с ценой; одинаковое складывается", async ({
  page,
}) => {
  let sheet = await openProduct(page, "Kebab Cheese");
  await pick(sheet, "checkbox", "roșii");
  await expect(
    sheet.getByRole("button", { name: "Adaugă · 105 lei" }),
  ).toBeVisible();
  await pick(sheet, "checkbox", /Becon/);
  await expect(
    sheet.getByRole("button", { name: "Adaugă · 120 lei" }),
  ).toBeVisible();
  await sheet.getByRole("button", { name: "Adaugă · 120 lei" }).click();

  // Та же настройка ещё раз — позиция одна, 2 шт.
  sheet = await openProduct(page, "Kebab Cheese");
  await pick(sheet, "checkbox", /Becon/);
  await pick(sheet, "checkbox", "roșii");
  await sheet.getByRole("button", { name: "Adaugă · 120 lei" }).click();
  await expect(cartBar(page)).toContainText("1 poziție");
  await expect(cartBar(page)).toContainText("240 lei");
});

test("лист закрывается: Esc (фокус назад на плитку), крестик, тап по фону", async ({
  page,
}) => {
  const title = page.getByRole("button", { name: "Kebab Cheese", exact: true });
  await title.focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: "Kebab Cheese" });
  await expect(sheet).toBeVisible();
  // Фокус внутри листа и не уходит под него
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      () => !!document.activeElement?.closest("dialog"),
    );
    expect(inside, `Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(title).toBeFocused();

  await title.click();
  await sheet.getByRole("button", { name: "Închide" }).click();
  await expect(sheet).toBeHidden();

  await title.click();
  await expect(sheet).toBeVisible();
  // Тап по затемнённой полосе над листом
  await page.mouse.click(195, 12);
  await expect(sheet).toBeHidden();
});

test("свайп вниз закрывает лист, короткий медленный — возвращает", async ({
  page,
}) => {
  const sheet = await openProduct(page, "Kebab Cheese");
  const client = await page.context().newCDPSession(page);
  const panel = sheet.locator(".sheet-panel");
  const box = (await panel.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 20; // за ручку

  // holdMs — пауза перед тем, как палец оторвался: 150 мс это уже не смах,
  // 0 — смах (окно смаха в use-sheet-drag.ts — 100 мс).
  async function drag(
    distance: number,
    steps: number,
    pauseMs: number,
    holdMs = 150,
  ) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= steps; i++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + (distance * i) / steps }],
      });
      await page.waitForTimeout(pauseMs);
    }
    if (holdMs > 0) await page.waitForTimeout(holdMs);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }

  await drag(60, 6, 30);
  await expect(sheet).toBeVisible();
  await expect
    .poll(async () => Math.round((await panel.boundingBox())!.y))
    .toBe(Math.round(box.y));

  await drag(box.height * 0.5, 10, 16);
  await expect(sheet).toBeHidden();
});

// Порог смаха 0.11 px/мс (решение архитектора 24.09.2026, было 0.4): спокойный
// смах пальцем обязан закрывать лист, а не возвращать его на место.
test("спокойный смах вниз тоже закрывает лист", async ({ page }) => {
  const sheet = await openProduct(page, "Kebab Cheese");
  const client = await page.context().newCDPSession(page);
  const box = (await sheet.locator(".sheet-panel").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 20;

  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  // 10 px за 50 мс — это 0.2 px/мс: быстрее нового порога и медленнее старого
  for (let i = 1; i <= 6; i++) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y + i * 10 }],
    });
    await page.waitForTimeout(50);
  }
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(sheet).toBeHidden();
});

test("корзина переживает перезагрузку", async ({ page }) => {
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();
  await expect(cartBar(page)).toContainText("1 poziție");
  await page.reload();
  await expect(cartBar(page)).toContainText("1 poziție");
  await expect(
    page.getByRole("button", { name: "Scade cantitatea: Coca-Cola" }),
  ).toBeVisible();
});

test("другой город: подтверждение; «Anulează» — назад, «Continuă» — пустая корзина", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();
  await expect(cartBar(page)).toContainText("1 poziție");

  await page.goto("/briceni");
  const dialog = page.getByRole("alertdialog", {
    name: "Ai schimbat orașul — coșul va fi golit",
  });
  await expect(dialog).toBeVisible();
  // Фокус — на «Anulează»; корзину Сорок здесь не показываем
  await expect(dialog.getByRole("button", { name: "Anulează" })).toBeFocused();
  await expect(cartBar(page)).toBeHidden();

  await dialog.getByRole("button", { name: "Anulează" }).click();
  await expect(page).toHaveURL(/\/soroca$/);
  await expect(cartBar(page)).toContainText("1 poziție");

  await page.goto("/briceni");
  await dialog.getByRole("button", { name: "Continuă" }).click();
  await expect(dialog).toBeHidden();
  await expect(cartBar(page)).toBeHidden();
  const saved = await page.evaluate(() => localStorage.getItem("apetit.cart"));
  expect(JSON.parse(saved!).state).toEqual({ city: "briceni", lines: [] });
});

test("мусор в localStorage не ломает страницу", async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "apetit.cart",
      '{"state":{"city":"soroca","lines":[{"qty":-5}]}',
    ),
  );
  await page.reload();
  await expect(page.locator("main h2").first()).toBeVisible();
  await expect(cartBar(page)).toBeHidden();
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();
  await expect(cartBar(page)).toContainText("1 poziție");
});

test.describe("десктоп", () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    hasTouch: false,
    isMobile: false,
  });

  test("лист — модалка 520px по центру; корзина — кнопка в шапке", async ({
    page,
  }) => {
    const sheet = await openProduct(page, "Kebab Cheese");
    const panel = sheet.locator(".sheet-panel");
    await expect
      .poll(async () => {
        const b = (await panel.boundingBox())!;
        return [Math.round(b.width), Math.round(b.x + b.width / 2)];
      })
      .toEqual([520, 640]);
    await sheet.getByRole("button", { name: "Adaugă · 105 lei" }).click();
    await expect(cartBar(page)).toBeHidden();
    const headerCart = page
      .getByRole("banner")
      .getByRole("button", { name: /Coș · 105 lei/ });
    await expect(headerCart).toBeVisible();
    await headerCart.click();
    await expect(page.getByRole("dialog", { name: "Coș" })).toBeVisible();
  });
});

test("«Extra» и «Sos aparte» — два блока: в блюдо и соусники отдельно", async ({
  page,
}) => {
  const sheet = await openProduct(page, "Kebab Cheese");
  const extra = sheet.getByRole("group", { name: "Extra" });
  const cups = sheet.getByRole("group", { name: "Sos aparte" });
  await expect(extra.getByRole("checkbox", { name: /Becon/ })).toHaveCount(1);
  await expect(extra.getByRole("checkbox", { name: /Sosieră/ })).toHaveCount(0);
  await expect(cups.getByRole("checkbox", { name: /Sosieră/ })).toHaveCount(7);
  // База (lipie + cașcaval) не убирается
  const without = sheet.getByRole("group", { name: "Fără" });
  await expect(without.getByRole("checkbox", { name: "cașcaval" })).toHaveCount(
    0,
  );
  await expect(without.getByRole("checkbox", { name: "roșii" })).toHaveCount(1);
});

test("«Golește coșul»: первое нажатие — «Da, golește», второе — пусто", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Adaugă: Kebab Cheese" }).click();
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();
  await cartBar(page).getByRole("button").click();
  const cart = page.getByRole("dialog", { name: "Coș" });

  await cart.getByRole("button", { name: "Golește coșul" }).click();
  const confirm = cart.getByRole("button", { name: "Da, golește" });
  await expect(confirm).toBeVisible();
  await expect(cart).toContainText("Kebab Cheese"); // ещё ничего не удалено

  await confirm.click();
  await expect(cart).toBeHidden();
  await expect(cartBar(page)).toBeHidden();
});
