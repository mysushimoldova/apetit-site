// Текст сообщения о заказе (SPEC §4.2) — HTML-режим Telegram. Всё, что
// пришло от человека (имя, адрес), экранируется; названия блюд — из кода,
// но экранируются тоже. Чистые функции без сети и базы — на них unit-тесты.
import type { Locale } from "@/data/points";
import { ORDER_TIME_ZONE } from "@/lib/order/hours";
import type { ReceiptLine } from "@/lib/order/receipt";
import { BOT_TEXTS } from "./texts";

export interface OrderMessageInput {
  number: number;
  pointName: string;
  name: string;
  /** Нормализованный +373XXXXXXXX */
  phone: string;
  address: string | null;
  lines: ReceiptLine[];
  total: number;
  /** ISO-время приёма */
  createdAt: string;
}

/** Telegram HTML: экранируются &, < и > (кавычки — не нужно). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ORDER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «19:42» по Кишинёву. */
export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

/** «+37368123456» → «+373 68 123 456» — Telegram сам делает номер ссылкой. */
export function formatPhone(phone: string): string {
  const m = /^\+373(\d{2})(\d{3})(\d{3})$/.exec(phone);
  return m ? `+373 ${m[1]} ${m[2]} ${m[3]}` : phone;
}

function lineText(line: ReceiptLine, lang: Locale): string {
  const t = BOT_TEXTS[lang];
  const names = (list: ReceiptLine["extra"]) =>
    list.map((n) => n[lang]).join(", ");
  const title = line.variant
    ? `${line.name[lang]} (${line.variant[lang]})`
    : line.name[lang];
  const head = `${line.qty} × ${escapeHtml(title)} — ${line.total} ${t.currency}`;
  const details: string[] = [];
  if (line.extra.length) details.push(`${t.extra}: ${names(line.extra)}`);
  if (line.cups.length) details.push(`${t.cup}: ${names(line.cups)}`);
  if (line.without.length) details.push(`${t.without}: ${names(line.without)}`);
  return details.length
    ? `${head}\n    ${escapeHtml(details.join(" · "))}`
    : head;
}

/** Сообщение точке (и копия владельцам): HTML, parse_mode=HTML. */
export function orderMessage(order: OrderMessageInput, lang: Locale): string {
  const t = BOT_TEXTS[lang];
  const parts = [
    `🔴 <b>${t.newOrder} #${order.number}</b>`,
    escapeHtml(order.pointName),
    "",
    `👤 ${escapeHtml(order.name)}`,
    `📞 ${formatPhone(order.phone)}`,
  ];
  if (order.address) parts.push(`📍 ${escapeHtml(order.address)}`);
  parts.push("", ...order.lines.map((l) => lineText(l, lang)), "");
  parts.push(`💰 <b>${t.total}: ${order.total} ${t.currency}</b>`);
  parts.push(`🕐 ${formatTime(new Date(order.createdAt))}`);
  return parts.join("\n");
}

/** То же сообщение после «Принят»: кнопки нет, внизу «Primit la 19:42». */
export function acceptedMessage(
  order: OrderMessageInput,
  lang: Locale,
  acceptedAt: Date,
): string {
  const t = BOT_TEXTS[lang];
  return `${orderMessage(order, lang)}\n\n✅ ${t.acceptedAt} ${formatTime(acceptedAt)}`;
}

export function reminderMessage(number: number, lang: Locale): string {
  return BOT_TEXTS[lang].reminder(number);
}

/** callback_data кнопки: «accept:<uuid>» — 43 байта, лимит Telegram 64. */
export const ACCEPT_PREFIX = "accept:";
export function acceptCallbackData(orderId: string): string {
  return `${ACCEPT_PREFIX}${orderId}`;
}
