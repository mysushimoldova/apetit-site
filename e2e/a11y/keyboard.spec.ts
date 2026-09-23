import { expect, test, type Page } from "@playwright/test";
import { deleteTestOrders, TEST_ORDER_NAME } from "../orders-db";
import { guardTelegram } from "../telegram-guard";
import { open, seedCart, setOpenTime, settle } from "./_shared";

// Клавиатура: весь путь заказа проходится табом, видно, где сейчас фокус,
// Esc закрывает шторки, а после закрытия фокус возвращается на ту кнопку,
// которой шторку открыли.

const usedPhones: string[] = [];
test.afterAll(() => deleteTestOrders(TEST_ORDER_NAME, usedPhones));
guardTelegram(test);

test.beforeEach(async ({ page }) => {
  await setOpenTime(page);
});

/** Что сейчас в фокусе: тег, роль, доступное имя. */
async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "—";
    const label =
      el.getAttribute("aria-label") ??
      el.textContent?.trim().slice(0, 40) ??
      "";
    return `${el.tagName.toLowerCase()}:${label}`;
  });
}

/** Нажать Tab и вернуть, что оказалось в фокусе. */
async function tab(page: Page): Promise<string> {
  await page.keyboard.press("Tab");
  return focused(page);
}

test("у элемента в фокусе видна рамка (focus-visible)", async ({ page }) => {
  await open(page, "/soroca");
  await page.keyboard.press("Tab");
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const style = getComputedStyle(el);
    const after = getComputedStyle(el, "::after");
    return {
      outlineWidth: style.outlineWidth,
      outlineStyle: style.outlineStyle,
      afterOutline: after.outlineWidth,
      shadow: style.boxShadow,
    };
  });
  const visible =
    (outline.outlineStyle !== "none" &&
      Number.parseFloat(outline.outlineWidth) > 0) ||
    Number.parseFloat(outline.afterOutline) > 0 ||
    outline.shadow !== "none";
  expect(visible, `рамка фокуса: ${JSON.stringify(outline)}`).toBe(true);
});

test("Tab проходит весь путь заказа: меню → корзина → оформление → отправка", async ({
  page,
}) => {
  await seedCart(page, "soroca", ["cola"]);
  await open(page, "/soroca");

  // 1. По табу можно дойти до кнопки корзины и открыть её Enter
  let seen = "";
  let cart = false;
  // В меню много карточек, и кнопка корзины лежит в самом конце страницы:
  // проверяем, что до неё можно дойти, а не за сколько именно нажатий
  for (let i = 0; i < 300 && !cart; i++) {
    seen = await tab(page);
    cart = /Coș|Корзина/i.test(seen);
  }
  expect(cart, `кнопка корзины не найдена табом, последний был ${seen}`).toBe(
    true,
  );
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // 2. Внутри корзины таб доходит до ссылки «Comandă»
  let order = false;
  for (let i = 0; i < 40 && !order; i++) {
    seen = await tab(page);
    order = /Comandă/i.test(seen);
  }
  expect(order, `ссылка заказа не найдена, последний был ${seen}`).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/soroca\/comanda$/);
  await settle(page);

  // 3. На оформлении таб доходит до кнопки отправки
  let submit = false;
  for (let i = 0; i < 80 && !submit; i++) {
    seen = await tab(page);
    submit = /Trimite comanda/i.test(seen);
  }
  expect(submit, `кнопка отправки не найдена, последний был ${seen}`).toBe(
    true,
  );
});

test("Esc закрывает шторку блюда и возвращает фокус на кнопку, которая её открыла", async ({
  page,
}) => {
  await open(page, "/soroca");
  const opener = page.locator(".tile-open").first();
  await opener.focus();
  const name = await focused(page);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(await focused(page)).toBe(name);
});

test("Esc закрывает корзину и возвращает фокус на её кнопку", async ({
  page,
}) => {
  await seedCart(page, "soroca", ["cola"]);
  await open(page, "/soroca");
  // На телефоне корзину открывает нижняя панель, на компьютере — шапка
  const bar = page.locator(".cart-bar[data-visible] button");
  const header = page.locator(".header-cart button");
  const opener =
    (await bar.count()) && (await bar.first().isVisible())
      ? bar.first()
      : header;
  await expect(opener).toBeVisible();
  await opener.focus();
  const name = await focused(page);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(await focused(page)).toBe(name);
});
