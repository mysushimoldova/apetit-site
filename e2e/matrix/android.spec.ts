import { expect, test } from "@playwright/test";
import { open, OPEN_TIME, seedCart, cartLine, setTime, shot } from "./_shared";

// Что ломается именно на Android: узкий экран 360, системная кнопка «назад»,
// подсветка тапа, клавиатура на форме заказа.
test.skip(
  ({ browserName, isMobile }) => browserName !== "chromium" || !isMobile,
  "только телефонный Chromium",
);

test("360 px: сетка в две колонки, цена в одну строку", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");

  const columns = await page
    .locator("div.tiles")
    .first()
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns, "сетка плиток").toBe(2);

  // Ценник не переносится на две строки: высота = высоте одной строки
  const wrapped = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".price-pill"))
      .filter((el) => {
        const line = parseFloat(getComputedStyle(el).lineHeight);
        return el.getBoundingClientRect().height > line * 1.6;
      })
      .map((el) => (el.textContent || "").trim()),
  );
  expect(wrapped, "ценник в две строки").toEqual([]);
  await shot(page, info, "android-360-meniu");
});

test("кнопка «назад» закрывает лист блюда, а не уводит со страницы", async ({
  page,
}) => {
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");

  await page.getByRole("button", { name: "Kebab Cheese", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Kebab Cheese" });
  await expect(sheet).toBeVisible();

  // Ровно то, что делает системная кнопка «назад» на телефоне
  await page.evaluate(() => history.back());
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/soroca$/);
});

test("кнопка «назад» закрывает корзину, а не уводит со страницы", async ({
  page,
}) => {
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");
  await page.getByRole("button", { name: "Adaugă: Kebab Cheese" }).click();
  await page.locator(".cart-bar").getByRole("button").click();

  const cart = page.getByRole("dialog", { name: "Coș" });
  await expect(cart).toBeVisible();
  // Ровно то, что делает системная кнопка «назад» на телефоне
  await page.evaluate(() => history.back());
  await expect(cart).toBeHidden();
  await expect(page).toHaveURL(/\/soroca$/);
});

test("подсветка тапа своя: синего прямоугольника Android нет", async ({
  page,
}) => {
  await setTime(page, OPEN_TIME);
  await open(page, "/soroca");
  const opaque = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href], button, [role='button']"))
      .filter((el) => {
        const value = getComputedStyle(el).getPropertyValue(
          "-webkit-tap-highlight-color",
        );
        return value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
      })
      .map(
        (el) =>
          `${el.tagName.toLowerCase()} «${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 25)}»`,
      ),
  );
  expect(opaque, "кнопка с системной подсветкой тапа").toEqual([]);
});

test("клавиатура на заказе: шапка на месте, кнопка отправки достижима", async ({
  page,
}, info) => {
  await setTime(page, OPEN_TIME);
  await seedCart(page, "soroca", [cartLine("kebab-cheese")]);
  await open(page, "/soroca/comanda");

  const header = page.getByRole("banner");
  const before = await header.evaluate((el) => getComputedStyle(el).position);
  expect(before).toBe("sticky");

  await page.getByLabel("Nume").click();
  // Клавиатура на Android уменьшает окно примерно вдвое
  await page.setViewportSize({ width: 390, height: 420 });
  await page.waitForTimeout(300);

  // Шапка осталась прилипшей к верху окна, а не уехала
  const box = (await header.boundingBox())!;
  expect(Math.round(box.y), "шапка уехала при клавиатуре").toBeLessThanOrEqual(
    1,
  );

  // До кнопки отправки можно доскроллить, и она целиком в окне
  const submit = page.getByRole("button", { name: "Trimite comanda" });
  await submit.scrollIntoViewIfNeeded();
  await expect(submit).toBeVisible();
  const submitBox = (await submit.boundingBox())!;
  expect(submitBox.y + submitBox.height).toBeLessThanOrEqual(421);
  await shot(page, info, "android-tastatura");
});
