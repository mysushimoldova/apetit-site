import { describe, expect, it } from "vitest";
import {
  CONTACT_STORAGE_KEY,
  loadContact,
  parseContact,
  saveContact,
} from "./contact";

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const contact = {
  name: "Ion Popescu",
  phone: "069 123 456",
  address: "str. Independenței 12",
};

describe("контакты на устройстве", () => {
  it("сохранили — прочитали то же самое", () => {
    const storage = memory();
    saveContact(contact, storage);
    expect(storage.data.has(CONTACT_STORAGE_KEY)).toBe(true);
    expect(loadContact(storage)).toEqual(contact);
  });

  it("ничего не сохранено, мусор, не объект — null", () => {
    expect(loadContact(memory())).toBeNull();
    expect(parseContact("{")).toBeNull();
    expect(parseContact("42")).toBeNull();
    expect(parseContact(JSON.stringify({ name: 1, phone: null }))).toBeNull();
  });

  it("неверное поле не подставляется, остальные — да", () => {
    expect(
      parseContact(JSON.stringify({ ...contact, phone: "12345" })),
    ).toEqual({ ...contact, phone: "" });
    expect(
      parseContact(JSON.stringify({ ...contact, name: "<script>" })),
    ).toEqual({ ...contact, name: "" });
  });

  it("хранилище бросает — без ошибок", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadContact(broken)).toBeNull();
    expect(() => saveContact(contact, broken)).not.toThrow();
  });
});
