import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CITY_STORAGE_KEY,
  clearCity,
  getSavedCity,
  saveCity,
} from "./city-storage";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

function withWindow(storage: unknown) {
  vi.stubGlobal("window", { localStorage: storage });
}

afterEach(() => vi.unstubAllGlobals());

describe("память выбранного города", () => {
  it("возвращает null, если ничего не сохранено", () => {
    withWindow(fakeStorage());
    expect(getSavedCity()).toBeNull();
  });

  it("сохраняет и читает slug", () => {
    const s = fakeStorage();
    withWindow(s);
    saveCity("otaci");
    expect(s.data.get(CITY_STORAGE_KEY)).toBe("otaci");
    expect(getSavedCity()).toBe("otaci");
  });

  it("очищает выбор", () => {
    const s = fakeStorage({ [CITY_STORAGE_KEY]: "soroca" });
    withWindow(s);
    clearCity();
    expect(getSavedCity()).toBeNull();
  });

  it("мусор в хранилище → null (не редиректим на 404)", () => {
    withWindow(fakeStorage({ [CITY_STORAGE_KEY]: "chisinau" }));
    expect(getSavedCity()).toBeNull();
  });

  it("localStorage бросает исключение → null и не падает", () => {
    withWindow({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(getSavedCity()).toBeNull();
    expect(() => saveCity("soroca")).not.toThrow();
    expect(() => clearCity()).not.toThrow();
  });

  it("без window (на сервере) → null и не падает", () => {
    expect(getSavedCity()).toBeNull();
    expect(() => saveCity("soroca")).not.toThrow();
  });
});
