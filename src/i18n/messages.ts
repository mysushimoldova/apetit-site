// Тексты интерфейса (CLAUDE.md: все тексты — через систему переводов).
// ro — основной, ru — второй. Ключи у обоих языков одинаковые (есть тест).
// Новый текст добавляется сразу в оба словаря; нет перевода — [ТЕКСТ: …].
import type { Locale } from "@/data/points";

export const DEFAULT_LOCALE: Locale = "ro";

export interface Messages {
  cityScreen: {
    /** Невидимый заголовок экрана городов — только для скринридеров */
    title: string;
  };
}

export const messages: Record<Locale, Messages> = {
  ro: {
    cityScreen: {
      title: "Alege orașul",
    },
  },
  ru: {
    cityScreen: {
      title: "Выберите город",
    },
  },
};

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
