import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  auditPage,
  cartLine,
  CLOSED_TIME,
  installCls,
  open,
  OPEN_TIME,
  orderCleanup,
  seedCart,
  setTime,
  TEST_NAME,
  watchProblems,
} from "./_shared";

// Путь заказа целиком на каждом профиле: шторка блюда (размеры и «без»),
// корзина (+/−, удалить, очистить), оформление (пустая отправка → ошибки,
// валидный заказ → подтверждение, точка закрыта).

// Заказы этого прогона удаляем из настоящей базы (уборка — в _shared.ts)
const uniquePhone = orderCleanup(test);

/** Отметить размер или галочку: сам вход скрыт, нажимаем его подпись. */
async function pick(
  sheet: Locator,
  role: "radio" | "checkbox",
  name: string | RegExp,
) {
  const control = sheet.page().getByRole(role, { name, exact: true });
  await sheet.page().locator("label").filter({ has: control }).click();
}

const cartBar = (page: Page) => page.locator(".cart-bar");

/** Корзину открывают снизу (телефон) или из шапки (десктоп). */
async function openCart(page: Page) {
  const bar = cartBar(page);
  if (await bar.isVisible()) await bar.getByRole("button").click();
  else
    await page.getByRole("banner").getByRole("button", { name: /Coș/ }).click();
  const cart = page.getByRole("dialog", { name: "Coș" });
  await expect(cart).toBeVisible();
  return cart;
}

test("шторка блюда: размеры, «без», «extra» — цена пересчитывается", async ({
  page,
}, info) => {
  const problems = watchProblems(page);
  await installCls(page);
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");

  await page
    .getByRole("button", { name: "Kebab XL / XXL", exact: true })
    .click();
  const sheet = page.getByRole("dialog", { name: "Kebab XL / XXL" });
  await expect(sheet).toBeVisible();
  await expect(
    sheet.getByRole("button", { name: "Adaugă · 80 lei" }),
  ).toBeVisible();

  await pick(sheet, "radio", "XXL");
  await expect(
    sheet.getByRole("radio", { name: "XXL", exact: true }),
  ).toBeChecked();
  await expect(sheet.getByText("430 g")).toBeVisible();

  // «Fără» — бесплатно, цена не меняется
  const without = sheet.getByRole("group", { name: "Fără" });
  await pick(sheet, "checkbox", "roșii");
  await expect(
    without.getByRole("checkbox", { name: "roșii", exact: true }),
  ).toBeChecked();
  await expect(
    sheet.getByRole("button", { name: "Adaugă · 99 lei" }),
  ).toBeVisible();

  // «Extra» — с ценой
  await pick(sheet, "checkbox", /Sos de usturoi/);
  await expect(
    sheet.getByRole("button", { name: "Adaugă · 114 lei" }),
  ).toBeVisible();

  await auditPage(page, info, problems, {
    screen: "20-fisa-produs",
    noShot: false,
  });
});

test("корзина: плюс, минус, удалить, очистить", async ({ page }, info) => {
  const problems = watchProblems(page);
  await installCls(page);
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");

  const plus = page.getByRole("button", { name: "Adaugă: Kebab Cheese" });
  await plus.click();
  await plus.click();
  const minus = page.getByRole("button", {
    name: "Scade cantitatea: Kebab Cheese",
  });
  await minus.click();
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();

  const cart = await openCart(page);
  await expect(cart).toContainText("Kebab Cheese");
  await expect(cart).toContainText("Coca-Cola");
  await auditPage(page, info, problems, { screen: "21-cos" });

  // Удалить одну позицию
  await cart.getByRole("button", { name: "Șterge: Coca-Cola" }).click();
  await expect(cart).not.toContainText("Coca-Cola");

  // Очистить корзину — подтверждение вторым нажатием на ту же кнопку
  await cart.getByRole("button", { name: "Golește coșul" }).click();
  await cart.getByRole("button", { name: "Da, golește" }).click();
  await expect(cart).toBeHidden();
  await expect(cartBar(page)).toBeHidden();

  expect(problems.list, "корзина: браузер ругается").toEqual([]);
});

test("заказ: пустая отправка → ошибки, валидный → подтверждение", async ({
  page,
}, info) => {
  const problems = watchProblems(page);
  await installCls(page);
  await setTime(page, OPEN_TIME);
  await seedCart(page, "soroca", [cartLine("kebab-cheese")]);
  await open(page, "/soroca/comanda");

  const submit = page.getByRole("button", { name: "Trimite comanda" });

  // Пустая отправка: заказ не уходит, видны ошибки, фокус на первой
  await submit.click();
  await expect(page).toHaveURL(/\/soroca\/comanda$/);
  await expect(page.getByText("Alege punctul")).toBeVisible();
  await expect(
    page.getByRole("radio", { name: /Apetit Centru/ }),
  ).toBeFocused();
  await auditPage(page, info, problems, { screen: "22-comanda-erori" });

  // Валидный заказ
  const centru = page.getByRole("radio", { name: /Apetit Centru/ });
  await page.locator("label").filter({ has: centru }).click();
  await page.getByLabel("Nume").fill(TEST_NAME);
  await page.getByLabel("Telefon").pressSequentially(uniquePhone());
  await submit.click();

  await expect(page).toHaveURL(/\/soroca\/comanda\/\d{4,}$/, {
    timeout: 30_000,
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Nr\. \d+$/,
  );
  await auditPage(page, info, problems, { screen: "23-confirmare" });
});

test("точка закрыта: баннер и кнопка «Trimite comanda» неактивна", async ({
  page,
}, info) => {
  const problems = watchProblems(page);
  await installCls(page);
  await setTime(page, CLOSED_TIME);
  await seedCart(page, "briceni", [cartLine("cola")]);
  await open(page, "/briceni/comanda");

  await expect(page.getByText("Primim comenzi 08:30–23:00")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Trimite comanda" }),
  ).toBeDisabled();

  await auditPage(page, info, problems, { screen: "24-comanda-inchis" });
});
