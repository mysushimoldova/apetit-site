// Тексты бота (SPEC §4.2): язык точки — ro, Otaci — ru. Эмодзи здесь
// разрешены: это сообщения в Telegram, не интерфейс сайта. Тексты из задачи
// архитектора; остальные — черновик на утверждение (см. PROGRESS.md).
import type { Locale } from "@/data/points";

export interface BotTexts {
  newOrder: string;
  total: string;
  extra: string;
  cup: string;
  without: string;
  accept: string;
  acceptedAt: string;
  alreadyAccepted: string;
  reminder: (number: number) => string;
  pointLinked: (name: string) => string;
  ownerLinked: string;
  wrongCode: string;
  alreadyLinked: string;
  startHint: string;
  currency: string;
}

export const BOT_TEXTS: Record<Locale, BotTexts> = {
  ro: {
    newOrder: "COMANDĂ NOUĂ",
    total: "TOTAL",
    extra: "Extra",
    cup: "Sos aparte",
    without: "Fără",
    accept: "✅ Am primit",
    acceptedAt: "Primit la",
    alreadyAccepted: "Deja primit",
    reminder: (n) => `⏰ Comanda ${n} așteaptă`,
    pointLinked: (name) => `Punct conectat: ${name}`,
    ownerLinked: "Proprietar conectat: vei primi copii ale tuturor comenzilor",
    wrongCode: "Cod greșit",
    alreadyLinked:
      "Punctul este deja conectat la alt chat. Schimbarea — prin administrator.",
    // Без «<» и «>»: сообщения уходят в parse_mode=HTML
    startHint: "Trimite: /start COD",
    currency: "lei",
  },
  ru: {
    newOrder: "НОВЫЙ ЗАКАЗ",
    total: "ИТОГО",
    extra: "Добавки",
    cup: "Соус отдельно",
    without: "Без",
    accept: "✅ Принят",
    acceptedAt: "Принят в",
    alreadyAccepted: "Уже принят",
    reminder: (n) => `⏰ Заказ ${n} ждёт`,
    pointLinked: (name) => `Точка подключена: ${name}`,
    ownerLinked: "Владелец подключён: будут копии всех заказов",
    wrongCode: "Неверный код",
    alreadyLinked:
      "Точка уже подключена к другому чату. Смена — через администратора.",
    startHint: "Отправьте: /start КОД",
    currency: "лей",
  },
};
