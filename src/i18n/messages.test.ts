import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getMessages, messages } from "./messages";

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

  it("заголовок экрана городов — тексты архитектора", () => {
    expect(getMessages("ro").cityScreen.title).toBe("Alege orașul");
    expect(getMessages("ru").cityScreen.title).toBe("Выберите город");
  });
});
