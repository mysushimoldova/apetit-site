// Перед любым прогоном: убедиться, что сервер на этом порту подняли сами
// тесты, а не хозяин своим `npm run dev`.
//
// Зачем. Playwright переиспользует уже запущенный dev-сервер
// (reuseExistingServer). Если это сервер, поднятый вручную, у него нет ни
// APETIT_E2E=1, ни секрета прогона — значит он работает с настоящим
// Telegram-ботом и настоящей базой, и каждый заказ из теста уходит живым
// сообщением владельцу. Так к владельцу и приходили «заказы», которых
// никто не делал.
//
// Проверка стоит здесь, до первого теста: не тот сервер — прогон
// останавливается, не создав ни одной строки в базе.
import type { FullConfig } from "@playwright/test";
import { TEST_HEADER } from "../src/server/orders/test-mode";

export default async function globalSetup(config: FullConfig): Promise<void> {
  const secret = process.env.APETIT_TEST_SECRET;
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!secret || !baseURL) {
    throw new Error(
      "e2e: нет APETIT_TEST_SECRET или baseURL — проверь playwright-конфиг",
    );
  }
  let response: Response;
  try {
    response = await fetch(`${baseURL}/api/dev/e2e`, {
      headers: { [TEST_HEADER]: secret },
    });
  } catch (error) {
    throw new Error(
      `e2e: сервер ${baseURL} не отвечает (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `e2e: сервер ${baseURL} отвечает ${response.status} на проверку тестового режима.\n` +
        "Скорее всего на этом порту работает твой собственный `npm run dev`:\n" +
        "у него нет APETIT_E2E=1, он ходит в НАСТОЯЩИЙ Telegram, и заказы из\n" +
        "тестов улетели бы живыми сообщениями. Останови его и запусти прогон снова.",
    );
  }
}
