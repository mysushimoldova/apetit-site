// Отправка заказа в Telegram (SPEC §4.2, §4.4): точке — с кнопкой «Принят»,
// владельцам — копия без кнопки. Запускается после ответа клиенту; заказ
// уже в базе. Telegram недоступен → до 3 попыток с паузой, потом ошибка в
// orders.telegram_error (клиент об этом не узнаёт — заказ принят).
import type { AcceptedOrder } from "@/server/orders/submit";
import type { TelegramApi } from "./api";
import { acceptCallbackData, orderMessage } from "./message";
import type { TelegramStore } from "./store";
import { BOT_TEXTS } from "./texts";

export interface NotifyDeps {
  api: TelegramApi | null;
  store: TelegramStore;
  log: (message: string, data: Record<string, unknown>) => void;
  /** Пауза между попытками; в тестах — без ожидания */
  sleep?: (ms: number) => Promise<void>;
}

export const RETRY_DELAYS_MS = [1_000, 3_000];

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** До 3 попыток: сразу, через 1 с, через 3 с. */
export async function withRetry<T>(
  attempt: () => Promise<T>,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
    if (i > 0) await sleep(RETRY_DELAYS_MS[i - 1]);
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function notifyOrder(
  order: AcceptedOrder,
  deps: NotifyDeps,
): Promise<void> {
  // Заказ из прогона тестов (orders.is_test) в Telegram не уходит никогда —
  // ни точке, ни владельцам. Проверка стоит здесь, у самой отправки, а не
  // у вызывающего: так её нельзя обойти, откуда бы ни позвали.
  if (order.isTest) {
    deps.log("telegram skipped: test order", { number: order.number });
    return;
  }
  const sleep = deps.sleep ?? wait;
  const lang = order.point.locale;
  const text = orderMessage(
    {
      number: order.number,
      pointName: order.point.name,
      name: order.name,
      phone: order.phone,
      address: order.address,
      lines: order.lines,
      total: order.total,
      createdAt: order.createdAt,
    },
    lang,
  );
  const meta = { number: order.number, point: order.point.id };

  let failure: string | null = null;
  // Чат точки: копию владельцам в него слать не нужно — заказ там уже есть,
  // причём с кнопкой (иначе рядом ляжет та же карточка без кнопки).
  let pointChatId: number | null = null;
  try {
    if (!deps.api) throw new Error("TELEGRAM_BOT_TOKEN not set");
    const api = deps.api;
    const chat = await deps.store.pointChat(order.point.id);
    if (!chat) throw new Error(`point not linked: ${order.point.id}`);
    pointChatId = chat.chatId;

    const { messageId } = await withRetry(
      () =>
        api.sendMessage({
          chatId: chat.chatId,
          text,
          replyMarkup: {
            inline_keyboard: [
              [
                {
                  text: BOT_TEXTS[lang].accept,
                  callback_data: acceptCallbackData(order.id),
                },
              ],
            ],
          },
        }),
      sleep,
    );
    await deps.store.setTelegramResult(order.id, { messageId, error: null });
    deps.log("telegram sent", { ...meta, messageId });
  } catch (error) {
    failure = errorText(error);
    deps.log("telegram failed", { ...meta, error: failure });
    try {
      await deps.store.setTelegramResult(order.id, {
        messageId: null,
        error: failure,
      });
    } catch (dbError) {
      deps.log("telegram failed: db", { ...meta, error: errorText(dbError) });
    }
  }

  // Копии владельцам — независимо от точки; ошибки только в лог
  if (!deps.api) return;
  const api = deps.api;
  let owners: number[] = [];
  try {
    owners = await deps.store.ownerChats();
  } catch (error) {
    deps.log("telegram owners: db", { ...meta, error: errorText(error) });
    return;
  }
  for (const chatId of owners) {
    if (chatId === pointChatId) continue;
    try {
      await withRetry(() => api.sendMessage({ chatId, text }), sleep);
    } catch (error) {
      deps.log("telegram owner copy failed", {
        ...meta,
        chatId,
        error: errorText(error),
      });
    }
  }
}
