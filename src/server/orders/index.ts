// Точка входа модуля заказов для приложения (Server Action). Память —
// одна на процесс сервера (см. memory.ts: TODO перенести в Supabase).
import "server-only";
import { createOrderMemory } from "./memory";
import { submitOrder, type SubmitResult } from "./submit";

export type { OrderReceipt, ReceiptLine } from "@/lib/order/receipt";
export type { SubmitResult } from "./submit";

const memory = createOrderMemory();

export function placeOrder(
  input: unknown,
  request: { now: Date; ip: string | null },
): Promise<SubmitResult> {
  return submitOrder(input, {
    ...request,
    memory,
    log: (message, data) => console.info(`[orders] ${message}`, data),
  });
}
