// Контакты на устройстве (SPEC §3 шаг 6): имя, телефон, адрес сохраняются
// после успешного заказа и подставляются в форму в следующий раз.
// Хранятся только в localStorage этого телефона; прочитанное проверяется
// теми же правилами, что и форма (чужое или битое — не подставляем).
import { fieldError } from "./schema";

export const CONTACT_STORAGE_KEY = "apetit.contact";

export interface Contact {
  name: string;
  phone: string;
  address: string;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

const local = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Разобрать сохранённое: поле, не прошедшее проверку, становится пустым. */
export function parseContact(raw: string | null): Contact | null {
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null) return null;
  const pick = (field: keyof Contact): string => {
    const value = (json as Record<string, unknown>)[field];
    if (typeof value !== "string") return "";
    return fieldError(field, value) === null ? value : "";
  };
  const contact = {
    name: pick("name"),
    phone: pick("phone"),
    address: pick("address"),
  };
  return contact.name || contact.phone || contact.address ? contact : null;
}

/** Сырая строка из хранилища (стабильна — годится для useSyncExternalStore). */
export function readContactRaw(
  storage: Storage | null = local(),
): string | null {
  try {
    return storage?.getItem(CONTACT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

export function loadContact(storage: Storage | null = local()): Contact | null {
  try {
    return parseContact(storage?.getItem(CONTACT_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function saveContact(
  contact: Contact,
  storage: Storage | null = local(),
): void {
  try {
    storage?.setItem(CONTACT_STORAGE_KEY, JSON.stringify(contact));
  } catch {
    // приватный режим / нет места — просто не запомним
  }
}
