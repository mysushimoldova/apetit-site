import { expect, test } from "@playwright/test";
import { deleteTestOrders, TEST_ORDER_NAME } from "../orders-db";
import { guardTelegram } from "../telegram-guard";
import {
  expectClean,
  open,
  reportModerate,
  scan,
  seedCart,
  setOpenTime,
  settle,
} from "./_shared";

// Доступность всех страниц сайта (axe-core). Профиль задаёт размер экрана,
// а список ниже — язык и адрес: получается четыре сочетания на страницу.

// Проверка заказа оставляет настоящую строку в базе — убираем за собой
const usedPhones: string[] = [];
test.afterAll(() => deleteTestOrders(TEST_ORDER_NAME, usedPhones));
guardTelegram(test);

// Часы точки: без рабочего времени кнопка заказа всегда неактивна
test.beforeEach(async ({ page }) => {
  await setOpenTime(page);
});

const PAGES = [
  { name: "экран городов", path: "/" },
  { name: "меню", path: "/soroca" },
  { name: "контакты", path: "/contacte" },
  { name: "конфиденциальность", path: "/confidentialitate" },
  { name: "условия", path: "/termeni" },
  { name: "404", path: "/nu-exista-asa-pagina" },
  { name: "экран городов (ru)", path: "/ru" },
  { name: "меню (ru)", path: "/ru/soroca" },
  { name: "контакты (ru)", path: "/ru/contacte" },
  { name: "конфиденциальность (ru)", path: "/ru/confidentialitate" },
  { name: "условия (ru)", path: "/ru/termeni" },
];

for (const item of PAGES) {
  test(`доступность: ${item.name}`, async ({ page }, info) => {
    await open(page, item.path);
    const violations = await scan(page, item.name);
    reportModerate(violations, info);
    expectClean(violations, item.name);
  });
}

test("доступность: шторка блюда", async ({ page }, info) => {
  await open(page, "/soroca");
  await page.locator(".tile-open").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const violations = await scan(page, "шторка блюда");
  reportModerate(violations, info);
  expectClean(violations, "шторка блюда");
});

test("доступность: корзина", async ({ page }, info) => {
  await seedCart(page, "soroca", ["cola", "kebab-cheese"]);
  await open(page, "/soroca");
  // На телефоне корзину открывает нижняя панель, на компьютере — кнопка в шапке
  const bar = page.locator(".cart-bar").getByRole("button");
  if (await bar.isVisible()) await bar.click();
  else await page.locator(".header-cart").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const violations = await scan(page, "корзина");
  reportModerate(violations, info);
  expectClean(violations, "корзина");
});

test("доступность: заказ — пустая форма", async ({ page }, info) => {
  await seedCart(page, "soroca", ["cola"]);
  await open(page, "/soroca/comanda");
  const violations = await scan(page, "заказ (пустой)");
  reportModerate(violations, info);
  expectClean(violations, "заказ (пустой)");
});

test("доступность: заказ — с ошибками полей", async ({ page }, info) => {
  await seedCart(page, "soroca", ["cola"]);
  await open(page, "/soroca/comanda");
  // Плохой телефон и невыбранная точка: под полями появляются ошибки
  await page.getByLabel("Nume").fill("Ion");
  const phone = page.getByLabel("Telefon");
  await phone.pressSequentially("12345");
  await phone.blur();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: /Trimite comanda/ }).click();
  await expect(page.getByText("Alege punctul")).toBeVisible();
  await settle(page);
  const violations = await scan(page, "заказ (ошибки)");
  reportModerate(violations, info);
  expectClean(violations, "заказ (ошибки)");
});

test("доступность: заказ — заполненная форма и подтверждение", async ({
  page,
}, info) => {
  await seedCart(page, "soroca", ["cola"]);
  await open(page, "/soroca/comanda");
  const noua = page.getByRole("radio", { name: /Apetit Soroca Nouă/ });
  await page.locator("label").filter({ has: noua }).click();
  await page.getByLabel("Nume").fill(TEST_ORDER_NAME);
  const digits = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  usedPhones.push(`+37369${digits}`);
  await page.getByLabel("Telefon").pressSequentially(`069${digits}`);

  const filled = await scan(page, "заказ (заполнен)");
  reportModerate(filled, info);
  expectClean(filled, "заказ (заполнен)");

  await page.getByRole("button", { name: /Trimite comanda/ }).click();
  await expect(page).toHaveURL(/\/soroca\/comanda\/\d{4,}$/);
  await settle(page);
  const done = await scan(page, "подтверждение");
  reportModerate(done, info);
  expectClean(done, "подтверждение");
});

test("доступность: заказ по-русски", async ({ page }, info) => {
  await seedCart(page, "soroca", ["cola"]);
  await open(page, "/ru/soroca/comanda");
  const violations = await scan(page, "заказ (ru)");
  reportModerate(violations, info);
  expectClean(violations, "заказ (ru)");
});
