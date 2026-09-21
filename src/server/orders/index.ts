// Точка входа модуля заказов для приложения (Server Action). Хранилище —
// таблица orders в Supabase (service role, только сервер); в памяти
// процесса ничего не держим. Принятый заказ уходит в Telegram после ответа
// клиенту (after из next/server): три попытки с паузой не задерживают форму.
import "server-only";
import { after } from "next/server";
import { getServiceClient } from "@/server/db/client";
import {
  getTelegramApi,
  getTelegramStore,
  telegramLog,
} from "@/server/telegram";
import { notifyOrder } from "@/server/telegram/notify";
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
    hashSecret: process.env.ORDER_HASH_SECRET,
    log: (message, data) => {
      const write =
        message === "db error" || message === "warning"
          ? console.error
          : console.info;
      write(`[orders] ${message}`, data);
    },
    onAccepted: (order) => {
      after(() =>
        notifyOrder(order, {
          api: getTelegramApi(),
          store: getTelegramStore(),
          log: telegramLog,
        }),
      );
    },
  });
}
