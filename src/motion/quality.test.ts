import { describe, expect, it } from "vitest";
import {
  canvasDpr,
  FPS_DOWN,
  FPS_STOP,
  MAX_DPR,
  MEASURE_WINDOWS,
  MIN_FRAME_MS,
  nextQuality,
  QUALITY_KEY,
  readQuality,
  shouldMeasure,
  WAVES_BY_QUALITY,
  writeQuality,
  type QualityLevel,
} from "./quality";

/** Хранилище на объекте — вместо sessionStorage браузера. */
function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe("уровень качества по кадрам в секунду", () => {
  it("быстро — уровень не меняется", () => {
    expect(nextQuality(1, 60)).toBe(1);
    expect(nextQuality(2, FPS_DOWN)).toBe(2);
  });

  it("меньше 50 — на уровень ниже, и так дважды", () => {
    const first = nextQuality(1, 45);
    expect(first).toBe(2);
    expect(nextQuality(first, 45)).toBe(3);
  });

  it("меньше 40 — сразу стоп", () => {
    expect(nextQuality(1, FPS_STOP - 1)).toBe(4);
    expect(nextQuality(2, 10)).toBe(4);
  });

  it("ниже четвёртого уровня падать некуда", () => {
    expect(nextQuality(4, 5)).toBe(4);
    expect(nextQuality(3, 45)).toBe(4);
  });

  it("меряем только там, где ждём 60 кадров", () => {
    expect(shouldMeasure(1)).toBe(true);
    expect(shouldMeasure(2)).toBe(true);
    // На третьем уровне кадров ровно 30 — измерение загнало бы движок в стоп
    expect(shouldMeasure(3)).toBe(false);
    expect(shouldMeasure(4)).toBe(false);
    expect(MEASURE_WINDOWS).toBe(2);
  });
});

describe("плотность пикселей и частота кадров по уровням", () => {
  it("холст рисуется в настоящую плотность экрана, потолок — тройная", () => {
    expect(MAX_DPR).toBe(3);
    expect(canvasDpr(3)).toBe(3);
    expect(canvasDpr(2)).toBe(2);
    expect(canvasDpr(1.25)).toBe(1.25);
    // Выше потолка не поднимаемся
    expect(canvasDpr(4)).toBe(3);
  });

  it("плотность не опускается ниже 1", () => {
    expect(canvasDpr(0.75)).toBe(1);
    expect(canvasDpr(0)).toBe(1);
  });

  it("уровень режет не разрешение холста, а число волн в поле фона", () => {
    expect(WAVES_BY_QUALITY[1]).toBe(10);
    expect(WAVES_BY_QUALITY[2]).toBe(6);
    expect(WAVES_BY_QUALITY[3]).toBe(4);
    expect(WAVES_BY_QUALITY[4]).toBe(4);
  });

  it("третий уровень — 30 кадров в секунду, четвёртый — ни одного", () => {
    expect(MIN_FRAME_MS[1]).toBe(0);
    expect(MIN_FRAME_MS[2]).toBe(0);
    expect(MIN_FRAME_MS[3]).toBeCloseTo(33.33, 1);
    expect(MIN_FRAME_MS[4]).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("память об уровне на время визита", () => {
  it("пустое хранилище — первый уровень", () => {
    expect(readQuality(fakeStorage())).toBe(1);
  });

  it("записанный уровень читается обратно", () => {
    const storage = fakeStorage();
    writeQuality(storage, 3);
    expect(storage.getItem(QUALITY_KEY)).toBe("3");
    expect(readQuality(storage)).toBe(3);
  });

  it("мусор в хранилище — первый уровень", () => {
    expect(readQuality(fakeStorage({ [QUALITY_KEY]: "9" }))).toBe(1);
    expect(readQuality(fakeStorage({ [QUALITY_KEY]: "abc" }))).toBe(1);
  });

  it("закрытое хранилище — не ошибка", () => {
    const closed = {
      getItem() {
        throw new Error("нельзя");
      },
      setItem() {
        throw new Error("нельзя");
      },
    } as unknown as Storage;
    expect(readQuality(closed)).toBe(1);
    expect(() => writeQuality(closed, 2 as QualityLevel)).not.toThrow();
    expect(readQuality(null)).toBe(1);
  });
});
