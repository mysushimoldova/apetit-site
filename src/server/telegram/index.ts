// Связка Telegram для приложения: клиент Bot API из TELEGRAM_BOT_TOKEN,
// хранилище поверх service-role клиента базы. В e2e (APETIT_E2E=1, не
// production) вместо Telegram — подменённый отправитель, который только
// пишет в лог: тесты не шлют сообщений настоящим точкам.
import "server-only";
import { getServiceClient } from "@/server/db/client";
import { createTelegramApi, type TelegramApi } from "./api";
import { createSupabaseTelegramStore, type TelegramStore } from "./store";

export function telegramLog(
  message: string,
  data: Record<string, unknown>,
): void {
  const write = /failed|error|wrong/.test(message)
    ? console.error
    : console.info;
  write(`[telegram] ${message}`, data);
}

function fakeApi(): TelegramApi {
  let nextId = 1;
  return {
    async sendMessage({ chatId, text }) {
      telegramLog("fake sendMessage", { chatId, length: text.length });
      return { messageId: nextId++ };
    },
    async editMessageText({ chatId, messageId }) {
      telegramLog("fake editMessageText", { chatId, messageId });
    },
    async answerCallbackQuery() {},
  };
}

let api: TelegramApi | null | undefined;

/** null — токена нет (заказ примется, в orders.telegram_error будет причина). */
export function getTelegramApi(): TelegramApi | null {
  if (api !== undefined) return api;
  if (process.env.NODE_ENV !== "production" && process.env.APETIT_E2E === "1") {
    api = fakeApi();
    return api;
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  api = token ? createTelegramApi(token) : null;
  return api;
}

let store: TelegramStore | null = null;
export function getTelegramStore(): TelegramStore {
  return (store ??= createSupabaseTelegramStore(getServiceClient));
}
