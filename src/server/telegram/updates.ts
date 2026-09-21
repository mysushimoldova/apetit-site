// Обработка событий Telegram (webhook или long polling в разработке):
// «/start <код>» — привязка чата к точке или владельцу; нажатие «Принят» —
// status=accepted, сообщение редактируется, кнопка исчезает. Всё лишнее
// молча игнорируется. Форма событий проверяется zod — Telegram присылает
// много полей, берём только нужные.
import { getPoint as getRealPoint, type Point } from "@/data/points";
import { ReceiptLineSchema } from "@/lib/order/receipt";
import { z } from "@/lib/zod";
import type { TelegramApi } from "./api";
import { ACCEPT_PREFIX, acceptedMessage, escapeHtml } from "./message";
import type { StoredOrder, TelegramStore } from "./store";
import { BOT_TEXTS } from "./texts";

const ChatSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  title: z.string().optional(),
  first_name: z.string().optional(),
  username: z.string().optional(),
});

const UserSchema = z.object({
  id: z.number().int(),
  first_name: z.string().optional(),
  username: z.string().optional(),
});

export const UpdateSchema = z.looseObject({
  update_id: z.number().int(),
  message: z
    .looseObject({
      chat: ChatSchema,
      from: UserSchema.optional(),
      text: z.string().optional(),
    })
    .optional(),
  callback_query: z
    .looseObject({
      id: z.string(),
      from: UserSchema,
      data: z.string().optional(),
      message: z
        .looseObject({ message_id: z.number().int(), chat: ChatSchema })
        .optional(),
    })
    .optional(),
});
export type TelegramUpdate = z.infer<typeof UpdateSchema>;

export interface UpdateDeps {
  api: TelegramApi;
  store: TelegramStore;
  log: (message: string, data: Record<string, unknown>) => void;
  now?: () => Date;
  getPoint?: (id: string) => Point | undefined;
}

export type UpdateResult =
  | "ignored"
  | "linked_point"
  | "linked_owner"
  | "wrong_code"
  | "already_linked"
  | "accepted"
  | "already_accepted"
  | "unknown_order"
  | "wrong_chat";

const START = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;
const CODE = /^[A-Z0-9]{4,32}$/i;
const StoredLinesSchema = z.array(ReceiptLineSchema);

function chatTitle(chat: z.infer<typeof ChatSchema>): string | null {
  return chat.title ?? chat.first_name ?? chat.username ?? null;
}

export async function handleUpdate(
  raw: unknown,
  deps: UpdateDeps,
): Promise<UpdateResult> {
  const parsed = UpdateSchema.safeParse(raw);
  if (!parsed.success) return "ignored";
  const update = parsed.data;
  if (update.callback_query) return handleCallback(update.callback_query, deps);
  if (update.message?.text) return handleMessage(update.message, deps);
  return "ignored";
}

type Message = NonNullable<TelegramUpdate["message"]>;
type Callback = NonNullable<TelegramUpdate["callback_query"]>;

async function handleMessage(
  message: Message,
  deps: UpdateDeps,
): Promise<UpdateResult> {
  const match = START.exec(message.text ?? "");
  if (!match) return "ignored";
  const chatId = message.chat.id;
  const code = match[1]?.toUpperCase();
  // Чат ещё не привязан — отвечаем по-румынски (язык точки узнаем после кода)
  const reply = (text: string) => deps.api.sendMessage({ chatId, text });

  if (!code) {
    await reply(BOT_TEXTS.ro.startHint);
    return "ignored";
  }
  const link = CODE.test(code) ? await deps.store.findCode(code) : null;
  if (!link) {
    deps.log("telegram wrong code", { chatId, length: code.length });
    await reply(BOT_TEXTS.ro.wrongCode);
    return "wrong_code";
  }

  if (link.kind === "owner") {
    await deps.store.linkOwner(chatId, chatTitle(message.chat));
    deps.log("telegram owner linked", { chatId });
    await reply(BOT_TEXTS.ro.ownerLinked);
    return "linked_owner";
  }

  const pointId = link.pointId ?? "";
  const point = (deps.getPoint ?? getRealPoint)(pointId);
  const lang = point?.locale ?? "ro";
  // Код — одноразовый: привязанную точку чужой чат не перехватит. Тот же чат
  // может повторить команду; перепривязка — удалить строку telegram_chats.
  const current = await deps.store.pointChat(pointId);
  if (current && current.chatId !== chatId) {
    deps.log("telegram point already linked", { chatId, point: pointId });
    await reply(BOT_TEXTS[lang].alreadyLinked);
    return "already_linked";
  }
  await deps.store.linkPoint(pointId, chatId, chatTitle(message.chat));
  deps.log("telegram point linked", { chatId, point: pointId });
  await reply(
    BOT_TEXTS[lang].pointLinked(escapeHtml(point?.name ?? link.label)),
  );
  return "linked_point";
}

function messageInput(order: StoredOrder, point: Point) {
  const lines = StoredLinesSchema.safeParse(order.items);
  return {
    number: order.number,
    pointName: point.name,
    name: order.name,
    phone: order.phone,
    address: order.address,
    lines: lines.success ? lines.data : [],
    total: order.total,
    createdAt: order.created_at,
  };
}

async function handleCallback(
  query: Callback,
  deps: UpdateDeps,
): Promise<UpdateResult> {
  const answer = (text?: string) =>
    deps.api.answerCallbackQuery({ id: query.id, text });
  const data = query.data ?? "";
  if (!data.startsWith(ACCEPT_PREFIX) || !query.message) {
    await answer();
    return "ignored";
  }
  const orderId = data.slice(ACCEPT_PREFIX.length);
  const order = await deps.store.orderById(orderId);
  if (!order) {
    await answer();
    return "unknown_order";
  }

  // Принять может только чат той точки, которой заказ адресован
  const chat = await deps.store.pointChat(order.point_id);
  if (!chat || chat.chatId !== query.message.chat.id) {
    deps.log("telegram accept from wrong chat", {
      number: order.number,
      chatId: query.message.chat.id,
    });
    await answer();
    return "wrong_chat";
  }

  const point = (deps.getPoint ?? getRealPoint)(order.point_id);
  const lang = point?.locale ?? "ro";
  const t = BOT_TEXTS[lang];
  const now = (deps.now ?? (() => new Date()))();
  const accepted = await deps.store.acceptOrder(orderId, now);
  const finalOrder = accepted ?? order;
  const acceptedAt = accepted ? now : new Date(order.accepted_at ?? now);

  // Кнопка исчезает в любом случае — сообщение без reply_markup
  if (point) {
    try {
      await deps.api.editMessageText({
        chatId: query.message.chat.id,
        messageId: query.message.message_id,
        text: acceptedMessage(
          messageInput(finalOrder, point),
          lang,
          acceptedAt,
        ),
      });
    } catch (error) {
      deps.log("telegram edit failed", {
        number: order.number,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!accepted) {
    await answer(t.alreadyAccepted);
    return "already_accepted";
  }
  deps.log("order accepted by", {
    number: order.number,
    point: order.point_id,
    userId: query.from.id,
    user: query.from.first_name ?? query.from.username ?? "",
  });
  await answer();
  return "accepted";
}
