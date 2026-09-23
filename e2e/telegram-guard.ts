// Страховка на уровне сети: из тестов к api.telegram.org не должно уходить
// ни одного запроса. Любая попытка обрывается и валит тест — молча
// «случайно отправить» сообщение владельцу больше нельзя.
//
// Главная защита другая (заказ помечается is_test, и отправка его не
// видит), эта — вторая линия: она ловит сам факт обращения к Telegram.
import { expect, type Page } from "@playwright/test";

const TELEGRAM = /^https?:\/\/([a-z0-9-]+\.)*telegram\.org\//i;

/** Подключить к файлу тестов: ставит запрет и проверяет его после каждого теста. */
export function guardTelegram(test: {
  beforeEach: (fn: (args: { page: Page }) => Promise<void>) => void;
  afterEach: (fn: () => Promise<void>) => void;
}): void {
  let hits: string[] = [];
  test.beforeEach(async ({ page }) => {
    hits = [];
    await page.route(TELEGRAM, async (route) => {
      hits.push(route.request().url());
      await route.abort();
    });
  });
  test.afterEach(async () => {
    expect(hits, "тест постучался в Telegram").toEqual([]);
  });
}
