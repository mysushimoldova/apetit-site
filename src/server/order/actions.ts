"use server";
// Server Action оформления заказа. Тонкая: берёт из запроса время и IP и
// отдаёт всё submitOrder() — там проверка zod, часы, лимиты и цена.
// Next 16 сам сверяет Origin с Host (защита от CSRF для Server Actions).
import { headers } from "next/headers";
import { placeOrder, type SubmitResult } from "@/server/orders";
import { isTestOrderRequest, TEST_HEADER } from "@/server/orders/test-mode";

/**
 * Тестовое время для e2e («вне часов»): только в dev-сервере Playwright
 * (APETIT_E2E=1) и никогда в production-сборке.
 */
function testNow(value: string | null): Date | null {
  if (process.env.NODE_ENV === "production") return null;
  if (process.env.APETIT_E2E !== "1" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function submitOrderAction(input: unknown): Promise<SubmitResult> {
  const h = await headers();
  return placeOrder(input, {
    now: testNow(h.get("x-apetit-test-now")) ?? new Date(),
    // Только Cloudflare: этот заголовок ставит их сеть, подделать его снаружи
    // нельзя. X-Forwarded-For подделывается — ему не доверяем.
    ip: h.get("cf-connecting-ip"),
    // Заказ из прогона тестов (сервер поднят тестами и знает секрет):
    // он помечается в базе is_test = true и не уходит ни в Telegram, ни в
    // напоминания. В боевой среде этот признак невозможен — см. test-mode.ts.
    isTest: isTestOrderRequest(h.get(TEST_HEADER)),
  });
}
