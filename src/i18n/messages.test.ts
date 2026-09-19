import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  formatPrice,
  getMessages,
  messages,
  plural,
} from "./messages";

// Все пути ключей словаря: cityScreen.title, … — чтобы сравнить ro и ru.
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) =>
    keyPaths(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("система переводов", () => {
  it("румынский — язык по умолчанию", () => {
    expect(DEFAULT_LOCALE).toBe("ro");
  });

  it("у ro и ru одинаковый набор ключей", () => {
    expect(keyPaths(messages.ru).sort()).toEqual(keyPaths(messages.ro).sort());
  });

  it("ни одного пустого текста", () => {
    for (const locale of ["ro", "ru"] as const) {
      for (const path of keyPaths(messages[locale])) {
        const value = path
          .split(".")
          .reduce<unknown>(
            (o, k) => (o as Record<string, unknown>)[k],
            messages[locale],
          );
        expect(value, `${locale}: ${path}`).toBeTypeOf("string");
        expect(
          (value as string).trim().length,
          `${locale}: ${path}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("число позиций — по правилам языка", () => {
    const ro = getMessages("ro").cart.positions;
    const ru = getMessages("ru").cart.positions;
    expect([1, 2, 19, 20, 101].map((n) => plural("ro", ro, n))).toEqual([
      "1 poziție",
      "2 poziții",
      "19 poziții",
      "20 de poziții",
      "101 poziții",
    ]);
    expect([1, 3, 5, 11, 21, 22].map((n) => plural("ru", ru, n))).toEqual([
      "1 позиция",
      "3 позиции",
      "5 позиций",
      "11 позиций",
      "21 позиция",
      "22 позиции",
    ]);
  });

  it("цена: число по правилам языка, валюта не отрывается переносом", () => {
    const ro = getMessages("ro");
    const ru = getMessages("ru");
    expect(formatPrice("ro", ro, 228)).toBe("228 lei");
    expect(formatPrice("ro", ro, 12500).replace(/\s/g, " ")).toBe("12.500 lei");
    expect(formatPrice("ru", ru, 1250).replace(/\s/g, " ")).toBe("1 250 лей");
  });

  it("тексты корзины — от архитектора", () => {
    const ro = getMessages("ro");
    expect(ro.sheet).toMatchObject({
      add: "Adaugă",
      size: "Mărime",
      free: "gratuit",
    });
    expect(ro.citySwitch.title).toBe("Ai schimbat orașul — coșul va fi golit");
    expect(getMessages("ru").cart.order).toBe("Заказать");
  });

  it("заголовок экрана городов — тексты архитектора", () => {
    expect(getMessages("ro").cityScreen.title).toBe("Alege orașul");
    expect(getMessages("ru").cityScreen.title).toBe("Выберите город");
  });
});
