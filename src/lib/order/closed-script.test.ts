import { describe, expect, it } from "vitest";
import { buildClosedScript, CLOSED_ATTRIBUTE } from "./closed-script";
import { isOpenAt, type Hours } from "./hours";

// Скрипт до первой отрисовки должен решать «открыто/закрыто» ровно так же,
// как isOpenAt() на сервере: иначе баннер мигнёт не вовремя.

/** Выполнить текст скрипта и сказать, поставил ли он признак на <body>. */
function run(script: string, now: Date): boolean {
  let attribute: string | null = null;
  const body = {
    setAttribute(name: string) {
      attribute = name;
    },
  };
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor() {
      super(now.getTime());
    }
  }
  new Function("document", "Date", script)({ body }, FakeDate);
  return attribute === CLOSED_ATTRIBUTE;
}

const HOURS: Hours = { open: "08:30", close: "23:00" };
/** Через полночь — такого у Apetit пока нет, но логика общая. */
const NIGHT: Hours = { open: "22:00", close: "02:00" };

describe("buildClosedScript", () => {
  const moments = [
    "2026-09-19T05:00:00Z", // 08:00 в Кишинёве — ещё закрыто
    "2026-09-19T05:35:00Z", // 08:35 — открылись
    "2026-09-19T09:00:00Z", // 12:00 — работают
    "2026-09-19T19:59:00Z", // 22:59 — последняя минута
    "2026-09-19T20:30:00Z", // 23:30 — закрыто
    "2026-09-19T00:30:00Z", // 03:30 — закрыто
  ];

  for (const hours of [HOURS, NIGHT]) {
    for (const iso of moments) {
      it(`${hours.open}–${hours.close} в ${iso}: как isOpenAt`, () => {
        const now = new Date(iso);
        expect(run(buildClosedScript(hours), now)).toBe(!isOpenAt(now, hours));
      });
    }
  }

  it("в тексте скрипта нет ничего, кроме наших значений", () => {
    const script = buildClosedScript(HOURS);
    expect(script).toContain("Europe/Chisinau");
    expect(script).toContain("510"); // 08:30
    expect(script).toContain("1380"); // 23:00
    expect(script).not.toContain("</script");
  });
});

describe("испорченные часы", () => {
  for (const bad of [
    { open: "не время", close: "23:00" },
    { open: "08:30", close: "99:99" },
    { open: "08:30", close: "</script><script>alert(1)</script>" },
  ]) {
    it(`${bad.open}–${bad.close}: скрипт пустой`, () => {
      expect(buildClosedScript(bad)).toBe("");
    });
  }
});
