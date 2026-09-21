// Минимальный клиент Telegram Bot API через fetch (без библиотек). Токен —
// только в адресе запроса; в ошибки и логи он не попадает.
export interface InlineKeyboard {
  inline_keyboard: { text: string; callback_data: string }[][];
}

export interface TelegramApi {
  sendMessage(params: {
    chatId: number;
    text: string;
    replyMarkup?: InlineKeyboard;
  }): Promise<{ messageId: number }>;
  editMessageText(params: {
    chatId: number;
    messageId: number;
    text: string;
  }): Promise<void>;
  answerCallbackQuery(params: { id: string; text?: string }): Promise<void>;
}

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly status: number,
    description: string,
  ) {
    super(`${method}: ${status} ${description}`);
    this.name = "TelegramError";
  }
}

const TIMEOUT_MS = 10_000;

export function createTelegramApi(
  token: string,
  fetchFn: typeof fetch = fetch,
): TelegramApi {
  async function call<T>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetchFn(
        `https://api.telegram.org/bot${token}/${method}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new TelegramError(method, 0, message);
    }
    let json: { ok?: boolean; result?: T; description?: string } = {};
    try {
      json = await response.json();
    } catch {
      // не JSON — ниже уйдёт как ошибка со статусом
    }
    if (!response.ok || !json.ok) {
      throw new TelegramError(
        method,
        response.status,
        json.description ?? "no description",
      );
    }
    return json.result as T;
  }

  return {
    async sendMessage({ chatId, text, replyMarkup }) {
      const result = await call<{ message_id: number }>("sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      });
      return { messageId: result.message_id };
    },
    async editMessageText({ chatId, messageId, text }) {
      await call("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
    },
    async answerCallbackQuery({ id, text }) {
      await call("answerCallbackQuery", {
        callback_query_id: id,
        ...(text ? { text } : {}),
      });
    },
  };
}
