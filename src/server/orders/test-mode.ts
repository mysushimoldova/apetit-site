// Признак «этот заказ оставлен прогоном тестов» (orders.is_test, миграция
// 0005). База у разработки и у боевого сайта одна, поэтому тестовость
// хранится в самой строке заказа: её видят Telegram, напоминания и любая
// будущая выборка, а не только тот процесс, который заказ принял.
//
// Пометку ставит ТОЛЬКО сервер, поднятый самими тестами. Три условия сразу:
//   1) сборка не боевая (NODE_ENV !== production);
//   2) сервер поднят с APETIT_E2E=1 (так его запускают playwright-конфиги);
//   3) заголовок x-apetit-test совпал с секретом APETIT_TEST_SECRET,
//      который playwright придумывает при каждом прогоне и передаёт своему
//      dev-серверу.
// В бою нет ни APETIT_E2E, ни секрета — значит is_test там не может стать
// true ни при каком запросе снаружи. Секрет — вторая преграда на случай,
// если APETIT_E2E когда-нибудь окажется выставлен по ошибке.
import { secretMatches } from "@/server/telegram/secret";

/** Заголовок, которым тесты помечают свои заказы. */
export const TEST_HEADER = "x-apetit-test";

export function isTestOrderRequest(header: string | null | undefined): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.APETIT_E2E !== "1") return false;
  return secretMatches(header, process.env.APETIT_TEST_SECRET);
}
