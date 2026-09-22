import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Оформление заказа (SPEC §3 шаги 5–6). Профиль — телефон 390px.
// Время: браузеру — page.clock, серверу — заголовок x-apetit-test-now
// (работает только в dev-сервере Playwright с APETIT_E2E=1).

const OPEN = "2026-09-19T09:00:00Z"; // 12:00 в Кишинёве
const CLOSED = "2026-09-19T20:30:00Z"; // 23:30

async function setTime(page: Page, browser: string, server = browser) {
  await page.clock.setFixedTime(new Date(browser));
  await page.setExtraHTTPHeaders({ "x-apetit-test-now": server });
}

type Line = {
  productSlug: string;
  variantId: string | null;
  addonIds: string[];
  removedIds: string[];
  qty: number;
};
const line = (productSlug: string, qty = 1): Line => ({
  productSlug,
  variantId: null,
  addonIds: [],
  removedIds: [],
  qty,
});

/** Корзина в localStorage до загрузки страницы (формат zustand persist). */
async function seedCart(page: Page, city: string, lines: Line[]) {
  await page.addInitScript(
    ([c, l]) =>
      window.localStorage.setItem(
        "apetit.cart",
        JSON.stringify({ state: { city: c, lines: l }, version: 1 }),
      ),
    [city, lines] as const,
  );
}

/** Новый номер на каждый запуск: лимит — 3 заказа с номера за 10 минут. */
const usedPhones: string[] = [];
function uniquePhone(): string {
  const digits = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
  usedPhones.push(`+37369${digits}`); // как хранится в базе
  return `069${digits}`;
}

// Заказы этого прогона — удалить из настоящей базы (service-role из
// .env.local). Только по своим телефонам и тестовому имени: настоящие
// заказы не трогаем. Нет .env.local — нечего удалять (заказы не писались).
test.afterAll(async () => {
  const envFile = resolve(process.cwd(), ".env.local");
  if (usedPhones.length === 0 || !existsSync(envFile)) return;
  process.loadEnvFile(envFile);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await db
    .from("orders")
    .delete()
    .eq("name", "Ion Popescu")
    .in("phone", usedPhones);
  if (error) throw new Error(`cleanup: ${error.code} ${error.message}`);
});

async function fillForm(page: Page, phone = uniquePhone()) {
  await page.getByLabel("Nume").fill("Ion Popescu");
  await page.getByLabel("Telefon").pressSequentially(phone);
}

const submit = (page: Page) =>
  page.getByRole("button", { name: "Trimite comanda" });

test.beforeEach(async ({ page }) => {
  await setTime(page, OPEN);
});

test("путь целиком: город → блюдо → корзина → оформление → подтверждение", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Soroca" }).click();
  await expect(page).toHaveURL(/\/soroca$/);
  await page.waitForFunction(() => document.readyState === "complete");

  await page.getByRole("button", { name: "Adaugă: Kebab Cheese" }).click();
  await page.locator(".cart-bar").getByRole("button").click();
  const cart = page.getByRole("dialog", { name: "Coș" });
  await cart.getByRole("link", { name: "Comandă" }).click();

  await expect(page).toHaveURL(/\/soroca\/comanda$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Comandă");
  // В Сороках две точки — нужно выбрать
  const noua = page.getByRole("radio", { name: /Apetit Soroca Nouă/ });
  await page.locator("label").filter({ has: noua }).click();
  await expect(noua).toBeChecked();

  await page.getByLabel("Nume").fill("Ion Popescu");
  const phone = page.getByLabel("Telefon");
  await phone.pressSequentially("069123");
  await expect(phone).toHaveValue("069 123"); // маска при вводе
  await phone.fill("");
  await phone.pressSequentially(uniquePhone());
  await expect(
    page.getByText("Casierul te va suna pentru confirmare"),
  ).toBeVisible();
  await expect(page.locator(".summary-total")).toContainText("105 lei");

  await submit(page).click();
  await expect(page).toHaveURL(/\/soroca\/comanda\/\d{4,}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Nr\. \d+$/,
  );
  await expect(page.getByText("Te sunăm în câteva minute")).toBeVisible();
  await expect(page.getByText("Apetit Soroca Nouă")).toBeVisible();
  await expect(page.getByText("1 × Kebab Cheese")).toBeVisible();
  await expect(page.locator(".summary-total")).toContainText("105 lei");
  await expect(
    page.getByRole("link", { name: /Sună la local · 068 372 707/ }),
  ).toHaveAttribute("href", "tel:+37368372707");
  // Своя ссылка tel: работает, а искать телефоны в тексте Safari запрещено
  await expect(page.locator('meta[name="format-detection"]')).toHaveAttribute(
    "content",
    "telephone=no, date=no, address=no, email=no",
  );

  // Корзина очищена после ответа сервера
  await page.getByRole("link", { name: "Înapoi la meniu" }).click();
  await expect(page).toHaveURL(/\/soroca$/);
  await page.waitForFunction(() => document.readyState === "complete");
  await expect(page.locator(".cart-bar")).toBeHidden();
});

test("пустая корзина → назад в меню", async ({ page }) => {
  await page.goto("/soroca/comanda");
  await expect(page).toHaveURL(/\/soroca$/);
});

test("без выбора точки и с плохим телефоном — ошибки под полями, заказ не уходит", async ({
  page,
}) => {
  await seedCart(page, "soroca", [line("cola", 2)]);
  await page.goto("/soroca/comanda");
  await page.getByLabel("Nume").fill("Ion");
  const phone = page.getByLabel("Telefon");
  await phone.pressSequentially("12345");
  await phone.blur();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Număr în format 0XX XXX XXX")).toBeVisible();

  await submit(page).click();
  await expect(page.getByText("Alege punctul")).toBeVisible();
  // Фокус — на первое неверное: выбор точки
  await expect(
    page.getByRole("radio", { name: /Apetit Centru/ }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\/soroca\/comanda$/);

  // Исправили — ошибка уходит сразу
  await phone.fill("");
  await phone.pressSequentially(uniquePhone());
  await expect(phone).not.toHaveAttribute("aria-invalid", "true");
});

test("вне часов: баннер в корзине и на оформлении, кнопки неактивны", async ({
  page,
}) => {
  await setTime(page, CLOSED);
  await seedCart(page, "otaci", [line("cola")]);

  await page.goto("/ru/otaci/comanda");
  // Otaci — одна точка, блока выбора нет; язык — русский
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByText("Принимаем заказы 08:30–23:00")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить заказ" }),
  ).toBeDisabled();

  await page.goto("/ru/otaci");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.locator(".cart-bar").getByRole("button").click();
  const cart = page.getByRole("dialog", { name: "Корзина" });
  await expect(cart.getByText("Принимаем заказы 08:30–23:00")).toBeVisible();
  await expect(cart.getByRole("button", { name: "Заказать" })).toBeDisabled();
});

test("вне часов решает сервер: у телефона часы врут — заказ не принят", async ({
  page,
}) => {
  await setTime(page, OPEN, CLOSED);
  await seedCart(page, "briceni", [line("cola")]);
  await page.goto("/briceni/comanda");
  await fillForm(page);
  await submit(page).click();
  await expect(page.getByText("Primim comenzi 08:30–23:00")).toBeVisible();
  await expect(submit(page)).toBeDisabled();
  await expect(page).toHaveURL(/\/briceni\/comanda$/);
});

test("блюда нет в точке (пицца в Сороках) — сервер отказывает, строка помечена", async ({
  page,
}) => {
  await seedCart(page, "soroca", [line("cola"), line("pizza-margarita")]);
  await page.goto("/soroca/comanda");
  const centru = page.getByRole("radio", { name: /Apetit Centru/ });
  await page.locator("label").filter({ has: centru }).click();
  await expect(page.getByText("1 × Margarita")).toBeVisible();
  await expect(page.getByText("nu este în acest punct")).toBeVisible();

  await fillForm(page);
  await submit(page).click();
  await expect(
    page.getByText(
      "Unele produse nu sunt disponibile în acest punct. Scoate-le din coș.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/soroca\/comanda$/);
});

test("ловушка для ботов заполнена — заказ не принят", async ({ page }) => {
  await seedCart(page, "briceni", [line("cola")]);
  await page.goto("/briceni/comanda");
  await fillForm(page);
  // Поле скрыто от человека — бот заполняет его напрямую
  await page
    .locator('input[name="website"]')
    .evaluate((el: HTMLInputElement) => (el.value = "http://spam.example"));
  await submit(page).click();
  await expect(
    page.getByText("Comanda nu a fost primită. Încearcă din nou."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/briceni\/comanda$/);
});

test("нет сети — понятная ошибка, повтор отправляет тот же заказ", async ({
  page,
}) => {
  await seedCart(page, "briceni", [line("cola", 3)]);
  await page.goto("/briceni/comanda");
  await fillForm(page);

  // Первая отправка Server Action обрывается
  let dropped = false;
  await page.route("**/briceni/comanda", async (route) => {
    if (route.request().method() === "POST" && !dropped) {
      dropped = true;
      await route.abort("internetdisconnected");
    } else {
      await route.continue();
    }
  });
  await submit(page).click();
  await expect(
    page.getByText("Nu s-a trimis. Verifică internetul și încearcă din nou."),
  ).toBeVisible();
  await expect(page.getByLabel("Nume")).toHaveValue("Ion Popescu");

  await submit(page).click();
  await expect(page).toHaveURL(/\/briceni\/comanda\/\d{4,}$/);
  await expect(page.locator(".summary-total")).toContainText("66 lei");
});

test("телефон: поля → «Coș» с Total → кнопка → строка про звонок", async ({
  page,
}) => {
  await seedCart(page, "briceni", [line("cola", 2)]);
  await page.goto("/briceni/comanda");
  const address = await page.getByLabel("Adresă").boundingBox();
  const cart = await page.getByRole("heading", { name: "Coș" }).boundingBox();
  const total = await page.locator(".summary-total").boundingBox();
  const button = await submit(page).boundingBox();
  const note = await page
    .getByText("Casierul te va suna pentru confirmare")
    .boundingBox();
  expect(address!.y).toBeLessThan(cart!.y);
  expect(total!.y).toBeLessThan(button!.y);
  expect(button!.y).toBeLessThan(note!.y);
});

test.describe("десктоп", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("«Coș» — колонкой справа от полей и кнопки", async ({ page }) => {
    await seedCart(page, "briceni", [line("cola", 2)]);
    await page.goto("/briceni/comanda");
    const name = await page.getByLabel("Nume").boundingBox();
    const button = await submit(page).boundingBox();
    const cart = await page.getByRole("heading", { name: "Coș" }).boundingBox();
    expect(cart!.x).toBeGreaterThan(name!.x + name!.width);
    expect(cart!.x).toBeGreaterThan(button!.x + button!.width);
    // Верх колонки — на уровне начала формы, а не под кнопкой
    expect(cart!.y).toBeLessThan(button!.y);
  });
});

test("во время отправки кнопка — «Se trimite…» и неактивна", async ({
  page,
}) => {
  await seedCart(page, "briceni", [line("cola")]);
  await page.goto("/briceni/comanda");
  await fillForm(page);
  // Сервер «думает» 1,5 секунды
  await page.route("**/briceni/comanda", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.continue();
  });
  await submit(page).click();
  const sending = page.getByRole("button", { name: "Se trimite…" });
  await expect(sending).toBeVisible();
  await expect(sending).toBeDisabled();
  await expect(page).toHaveURL(/\/briceni\/comanda\/\d{4,}$/);
});

test("имя, телефон и адрес запоминаются после заказа и подставляются снова", async ({
  page,
}) => {
  await seedCart(page, "briceni", [line("cola")]);
  await page.goto("/briceni/comanda");
  const phone = uniquePhone();
  await fillForm(page, phone);
  await page.getByLabel("Adresă").fill("Strada Mihai Eminescu 1");
  // Пока заказ не отправлен — ничего не сохранено
  expect(
    await page.evaluate(() => localStorage.getItem("apetit.contact")),
  ).toBeNull();
  await submit(page).click();
  await expect(page).toHaveURL(/\/briceni\/comanda\/\d{4,}$/);

  // Новый заказ: блюдо в корзину → оформление — поля уже заполнены
  await page.goto("/briceni");
  await page.waitForFunction(() => document.readyState === "complete");
  await page.getByRole("button", { name: "Adaugă: Coca-Cola" }).click();
  await page.goto("/briceni/comanda");
  await expect(page.getByLabel("Nume")).toHaveValue("Ion Popescu");
  await expect(page.getByLabel("Telefon")).toHaveValue(
    `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`,
  );
  await expect(page.getByLabel("Adresă")).toHaveValue(
    "Strada Mihai Eminescu 1",
  );
});

test.describe("геолокация разрешена (человек в Сороках)", () => {
  test.use({
    geolocation: { latitude: 48.16, longitude: 28.305 },
    permissions: ["geolocation"],
  });

  test("в карточках точек — адрес и расстояние", async ({ page }) => {
    await seedCart(page, "soroca", [line("cola")]);
    await page.goto("/soroca/comanda");
    const centru = page.locator(".point-card", { hasText: "Apetit Centru" });
    const noua = page.locator(".point-card", {
      hasText: "Apetit Soroca Nouă",
    });
    await expect(centru).toContainText("Str. Independenței 72");
    await expect(centru).toContainText("~0,4 km");
    await expect(noua).toContainText("Dimitrie Cantemir 24F");
    await expect(noua).toContainText("~2,0 km");
  });
});

test("геолокация запрещена — карточки без расстояния, без ошибок", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await seedCart(page, "soroca", [line("cola")]);
  await page.goto("/soroca/comanda");
  const cards = page.locator(".point-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText("Str. Independenței 72");
  await expect(cards.first()).not.toContainText("km");
  expect(errors).toEqual([]);
});
