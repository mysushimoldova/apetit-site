// Код отказа сервера (submit.ts → SubmitResult) → ключ текста в словаре
// (t.checkout.errors). Здесь только те коды, на которые форма отвечает одним
// сообщением; у остальных («invalid», «closed», «unavailable») есть своё
// поведение — подсветить поля, показать часы работы, пометить позиции.
//
// Отдельный файл, а не switch в форме: раньше новый код «db_error» просто
// проваливался в default и человек видел «Заказ не принят» вместо «не смогли
// записать, попробуйте ещё раз» (аудит Н5). Теперь новый код отказа, забытый
// здесь, не соберётся — и это же проверяет тест рядом.
export const SERVER_ERROR_TEXT = {
  point_paused: "pointPaused",
  rate_limited: "rateLimited",
  db_error: "dbError",
  rejected: "rejected",
} as const;

/** Ключи текстов, которые форма показывает как «сообщение сервера». */
export type ServerErrorText =
  | (typeof SERVER_ERROR_TEXT)[keyof typeof SERVER_ERROR_TEXT]
  | "network"
  | "unavailable";
