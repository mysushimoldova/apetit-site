// Черновик формы оформления: имя, телефон, адрес и выбранная точка — пока
// человек ещё не отправил заказ. Нужен, чтобы переключение RO/RU (это
// полная загрузка страницы) не стирало введённое (SPEC §7). Живёт в
// sessionStorage — только эта вкладка, до её закрытия; после заказа
// стирается. Прочитанное проверяется теми же правилами, что и форма.
import type { Contact } from "./contact";
import { ADDRESS_MAX, NAME_MAX } from "./fields";

/** Черновик может быть недописан («06»), поэтому проверяется только длина;
 *  формат проверит форма при отправке. Телефон с маской — до 15 знаков. */
const MAX_LENGTH: Record<keyof Contact, number> = {
  name: NAME_MAX,
  phone: 15,
  address: ADDRESS_MAX,
};

export const DRAFT_STORAGE_KEY = "apetit.checkout-draft";

export interface Draft extends Contact {
  pointId: string | null;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

const session = (): Storage | null => {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

/** Разобрать сохранённое: слишком длинное или чужое поле становится пустым. */
export function parseDraft(raw: string | null): Draft | null {
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const obj = json as Record<string, unknown>;
  const pick = (field: keyof Contact): string => {
    const value = obj[field];
    return typeof value === "string" && value.length <= MAX_LENGTH[field]
      ? value
      : "";
  };
  const pointId =
    typeof obj.pointId === "string" && /^[a-z-]{1,40}$/.test(obj.pointId)
      ? obj.pointId
      : null;
  return {
    name: pick("name"),
    phone: pick("phone"),
    address: pick("address"),
    pointId,
  };
}

/** Сырая строка из хранилища (стабильна — годится для useSyncExternalStore). */
export function readDraftRaw(
  storage: Storage | null = session(),
): string | null {
  try {
    return storage?.getItem(DRAFT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft, storage: Storage | null = session()) {
  try {
    storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // приватный режим / нет места — просто не запомним
  }
}

export function clearDraft(storage: Storage | null = session()) {
  try {
    storage?.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // нечего чистить
  }
}
