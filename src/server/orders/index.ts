// Точка входа модуля заказов для приложения (Server Action). Хранилище —
// таблица orders в Supabase (service role, только сервер); в памяти
// процесса ничего не держим: номера, лимиты и дубли — в базе.
import "server-only";
import { getServiceClient } from "@/server/db/client";
import { createSupabaseOrderStore } from "./store";
import { submitOrder, type SubmitResult } from "./submit";

export type { OrderReceipt, ReceiptLine } from "@/lib/order/receipt";
export type { SubmitResult } from "./submit";

const store = createSupabaseOrderStore(getServiceClient);

export function placeOrder(
  input: unknown,
  request: { now: Date; ip: string | null },
): Promise<SubmitResult> {
  return submitOrder(input, {
    ...request,
    store,
    log: (message, data) => {
      const write = message === "db error" ? console.error : console.info;
      write(`[orders] ${message}`, data);
    },
  });
}
