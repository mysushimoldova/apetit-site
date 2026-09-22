// Тексты бота (SPEC §4.2–4.3): язык точки — ro, Otaci — ru. Эмодзи здесь
// разрешены: это сообщения в Telegram, не интерфейс сайта. Утверждены
// архитектором 21.09.2026. Сообщения уходят в parse_mode=HTML — в текстах
// не должно быть «<» и «>» (есть тест).
import type { Locale } from "@/data/points";

export interface BotTexts {
  newOrder: string;
  /** Заголовок принятого: «🟢 PRELUATĂ · 21:12 — #1027» */
  accepted: string;
  total: string;
  extra: string;
  cup: string;
  without: string;
  accept: string;
  alreadyAccepted: string;
  /** Точке: заказ ждёт; minutes — сколько прошло */
  reminder: (number: number, minutes: number) => string;
  /** Владельцам: точка не приняла заказ; minutes — сколько прошло */
  ownerAlert: (
    pointName: string,
    number: number,
    minutes: number,
    pointPhone: string,
  ) => string;
  pointLinked: (name: string) => string;
  ownerLinked: string;
  wrongCode: string;
  alreadyLinked: string;
  startHint: string;
  currency: string;
}

/** 1 minut, 2–19 minute, 20+ de minute (правило румынского языка). */
export function roMinutes(n: number): string {
  if (n === 1) return "1 minut";
  const last = n % 100;
  return last >= 2 && last <= 19 ? `${n} minute` : `${n} de minute`;
}

/** 1 минута, 2–4 минуты, 5–20 минут, 21 минута, 22 минуты… */
export function ruMinutes(n: number): string {
  const last = n % 10;
  const tens = n % 100;
  if (tens >= 11 && tens <= 19) return `${n} минут`;
  if (last === 1) return `${n} минута`;
  if (last >= 2 && last <= 4) return `${n} минуты`;
  return `${n} минут`;
}

export const BOT_TEXTS: Record<Locale, BotTexts> = {
  ro: {
    newOrder: "COMANDĂ NOUĂ",
    accepted: "PRELUATĂ",
    total: "TOTAL",
    extra: "Extra",
    cup: "Sos aparte",
    without: "Fără",
    accept: "✅ Am preluat",
    alreadyAccepted: "Deja preluată",
    reminder: (n, minutes) =>
      `⏰ Comanda #${n} așteaptă — ${roMinutes(minutes)}`,
    ownerAlert: (point, n, minutes, phone) =>
      `⚠️ ${point} nu a preluat comanda #${n}. Au trecut ${roMinutes(minutes)}. Tel. punct: ${phone}`,
    pointLinked: (name) => `Punct conectat: ${name}`,
    ownerLinked: "Proprietar conectat: vei primi copii ale tuturor comenzilor",
    wrongCode: "Cod greșit",
    alreadyLinked:
      "Punctul este deja conectat la alt chat. Schimbarea — prin administrator.",
    startHint: "Trimite: /start COD",
    currency: "lei",
  },
  ru: {
    newOrder: "НОВЫЙ ЗАКАЗ",
    accepted: "ПРИНЯТ",
    total: "ИТОГО",
    extra: "Добавки",
    cup: "Соус отдельно",
    without: "Без",
    accept: "✅ Принял",
    alreadyAccepted: "Уже принят",
    reminder: (n, minutes) => `⏰ Заказ №${n} ждёт — ${ruMinutes(minutes)}`,
    ownerAlert: (point, n, minutes, phone) =>
      `⚠️ ${point} не принял заказ №${n}. Прошло ${ruMinutes(minutes)}. Тел. точки: ${phone}`,
    pointLinked: (name) => `Точка подключена: ${name}`,
    ownerLinked: "Владелец подключён: будут копии всех заказов",
    wrongCode: "Неверный код",
    alreadyLinked:
      "Точка уже подключена к другому чату. Смена — через администратора.",
    startHint: "Отправьте: /start КОД",
    currency: "лей",
  },
};
