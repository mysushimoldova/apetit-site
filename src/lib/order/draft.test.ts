import { describe, expect, it } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  clearDraft,
  parseDraft,
  readDraftRaw,
  saveDraft,
} from "./draft";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe("черновик формы оформления", () => {
  it("сохраняется, читается и стирается", () => {
    const s = fakeStorage();
    const draft = {
      name: "Io",
      phone: "069 12",
      address: "",
      pointId: "soroca-noua",
    };
    saveDraft(draft, s);
    expect(parseDraft(readDraftRaw(s))).toEqual(draft);
    clearDraft(s);
    expect(readDraftRaw(s)).toBeNull();
    expect(s.data.has(DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("недописанные поля сохраняются как есть", () => {
    expect(
      parseDraft(JSON.stringify({ name: "I", phone: "0", address: "" })),
    ).toEqual({ name: "I", phone: "0", address: "", pointId: null });
  });

  it("слишком длинное и чужое — пусто; битый JSON — null", () => {
    expect(
      parseDraft(
        JSON.stringify({
          name: "x".repeat(41),
          phone: 123,
          address: "y".repeat(121),
          pointId: "../etc",
        }),
      ),
    ).toEqual({ name: "", phone: "", address: "", pointId: null });
    expect(parseDraft("{oops")).toBeNull();
    expect(parseDraft("42")).toBeNull();
    expect(parseDraft(null)).toBeNull();
  });

  it("хранилище бросает — ничего не падает", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readDraftRaw(broken)).toBeNull();
    expect(() =>
      saveDraft({ name: "", phone: "", address: "", pointId: null }, broken),
    ).not.toThrow();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});
