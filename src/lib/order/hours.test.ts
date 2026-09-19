import { describe, expect, it } from "vitest";
import { chisinauTime, isOpenAt } from "./hours";

const HOURS = { open: "08:30", close: "23:00" };

describe("часы работы по Europe/Chisinau", () => {
  it("летом (UTC+3): 08:30 открыто, 08:29 закрыто, 22:59 открыто, 23:00 закрыто", () => {
    expect(isOpenAt(new Date("2026-09-19T05:29:00Z"), HOURS)).toBe(false);
    expect(isOpenAt(new Date("2026-09-19T05:30:00Z"), HOURS)).toBe(true);
    expect(isOpenAt(new Date("2026-09-19T19:59:59Z"), HOURS)).toBe(true);
    expect(isOpenAt(new Date("2026-09-19T20:00:00Z"), HOURS)).toBe(false);
  });

  it("зимой (UTC+2) — сдвиг на час", () => {
    expect(isOpenAt(new Date("2026-01-15T06:29:00Z"), HOURS)).toBe(false);
    expect(isOpenAt(new Date("2026-01-15T06:30:00Z"), HOURS)).toBe(true);
    expect(isOpenAt(new Date("2026-01-15T20:59:00Z"), HOURS)).toBe(true);
    expect(isOpenAt(new Date("2026-01-15T21:00:00Z"), HOURS)).toBe(false);
  });

  it("ночь и полночь — закрыто", () => {
    expect(isOpenAt(new Date("2026-09-19T21:00:00Z"), HOURS)).toBe(false); // 00:00
    expect(isOpenAt(new Date("2026-09-19T00:30:00Z"), HOURS)).toBe(false); // 03:30
  });

  it("часы через полночь (на будущее: 10:00–02:00)", () => {
    const late = { open: "10:00", close: "02:00" };
    expect(isOpenAt(new Date("2026-09-19T22:30:00Z"), late)).toBe(true); // 01:30
    expect(isOpenAt(new Date("2026-09-19T23:30:00Z"), late)).toBe(false); // 02:30
  });

  it("время в Кишинёве не зависит от часового пояса сервера", () => {
    expect(chisinauTime(new Date("2026-09-19T05:30:00Z"))).toBe(8 * 60 + 30);
  });
});
