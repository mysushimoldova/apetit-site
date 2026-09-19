// Тексты интерфейса (CLAUDE.md: все тексты — через систему переводов).
// ro — основной, ru — второй. Ключи у обоих языков одинаковые (есть тест).
// Новый текст добавляется сразу в оба словаря; нет перевода — [ТЕКСТ: …].
import type { Locale } from "@/data/points";

export const DEFAULT_LOCALE: Locale = "ro";

export const messages = {
  ro: {
    cityScreen: {
      /** Невидимый заголовок экрана городов — только для скринридеров */
      title: "Alege orașul",
    },
  },
  ru: {
    cityScreen: {
      title: "Выберите город",
    },
  },
} as const satisfies Record<Locale, unknown>;

export type Messages = (typeof messages)[typeof DEFAULT_LOCALE];

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
