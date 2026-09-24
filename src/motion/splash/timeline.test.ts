import { describe, expect, it } from "vitest";
import {
  exitMs,
  PHOTO_RISE_PX,
  splashPhotoMotion,
  splashVisual,
  totalMs,
  type SplashExit,
} from "./timeline";

const S = (exit: SplashExit = "lift", fade = 200) => ({ fade, exit });

describe("длительность ухода", () => {
  it("в полтора с лишним раза длиннее появления", () => {
    expect(exitMs(200)).toBe(320);
  });

  it("никогда не короче 180 мс", () => {
    expect(exitMs(120)).toBe(192);
    expect(exitMs(0)).toBe(180);
  });

  it("вся заставка = держится + уход", () => {
    expect(totalMs(1500, 200)).toBe(1820);
  });
});

describe("появление", () => {
  it("в нулевой момент ничего не видно, но круг уже начал расти", () => {
    const v = splashVisual(0, 1500, S());
    expect(v.discAlpha).toBe(0);
    expect(v.foodAlpha).toBe(0);
    expect(v.discScale).toBeCloseTo(0.55, 5);
    expect(v.foodScale).toBeCloseTo(0.9, 5);
  });

  it("к концу появления круг и блюдо на месте и непрозрачны", () => {
    const v = splashVisual(400, 1500, S());
    expect(v.discAlpha).toBe(1);
    expect(v.foodAlpha).toBe(1);
    expect(v.discScale).toBe(1);
    expect(v.foodScale).toBe(1);
    expect(v.liftShare).toBe(0);
  });

  it("блюдо трогается позже круга", () => {
    const v = splashVisual(40, 1500, S());
    expect(v.foodAlpha).toBe(0);
    expect(v.discAlpha).toBeGreaterThan(0);
  });

  it("пока держится — всё неподвижно", () => {
    const v = splashVisual(900, 1500, S());
    expect(v).toMatchObject({
      discScale: 1,
      foodScale: 1,
      foodAlpha: 1,
      liftShare: 0,
      visible: true,
    });
  });
});

describe("уход", () => {
  it("«шторка вверх» поднимает всю заставку и заканчивается", () => {
    const mid = splashVisual(1500 + 160, 1500, S("lift"));
    expect(mid.liftShare).toBeGreaterThan(0);
    expect(mid.liftShare).toBeLessThan(1);
    expect(mid.visible).toBe(true);

    const done = splashVisual(1500 + 320, 1500, S("lift"));
    expect(done.visible).toBe(false);
  });

  it("«затухание» гасит круг и блюдо, не двигая их", () => {
    const v = splashVisual(1500 + 160, 1500, S("fade"));
    expect(v.liftShare).toBe(0);
    expect(v.foodAlpha).toBeLessThan(1);
    expect(v.foodScale).toBe(1);
  });

  it("«уезжает в меню» уменьшает блюдо и уводит его вбок и вниз", () => {
    const v = splashVisual(1500 + 160, 1500, S("zoom"));
    expect(v.foodScale).toBeLessThan(1);
    expect(v.zoomX).toBeLessThan(0);
    expect(v.zoomY).toBeGreaterThan(0);
  });

  it("касание в середине — уход начинается сразу с этого момента", () => {
    const tapped = splashVisual(600, 1500, S("lift"), 600);
    expect(tapped.liftShare).toBe(0);
    const later = splashVisual(760, 1500, S("lift"), 600);
    expect(later.liftShare).toBeGreaterThan(0);
    expect(splashVisual(920, 1500, S("lift"), 600).visible).toBe(false);
  });
});

describe("движение фото на заставке", () => {
  const HOLD = 1500;
  const FROM = 1.06;

  it("в начале — начальный масштаб и никакого подъёма", () => {
    const start = splashPhotoMotion(0, HOLD, FROM);
    expect(start.scale).toBeCloseTo(FROM, 5);
    expect(start.risePx).toBeCloseTo(0, 5);
  });

  it("к концу показа — масштаб ровно 1 и полный подъём", () => {
    const end = splashPhotoMotion(HOLD, HOLD, FROM);
    expect(end.scale).toBeCloseTo(1, 5);
    expect(end.risePx).toBeCloseTo(PHOTO_RISE_PX, 5);
  });

  it("кривая замедления: за первую половину проходит больше половины пути", () => {
    const half = splashPhotoMotion(HOLD / 2, HOLD, FROM);
    const passed = (FROM - half.scale) / (FROM - 1);
    expect(passed).toBeGreaterThan(0.5);
    expect(passed).toBeLessThan(1);
    // Масштаб только уменьшается — перелёта нет
    expect(half.scale).toBeLessThan(FROM);
    expect(half.scale).toBeGreaterThan(1);
  });

  it("после конца показа ничего не ломается", () => {
    const after = splashPhotoMotion(HOLD * 2, HOLD, FROM);
    expect(after.scale).toBeCloseTo(1, 5);
    expect(after.risePx).toBeCloseTo(PHOTO_RISE_PX, 5);
  });

  it("zoomFrom = 1 — фото просто стоит и чуть поднимается", () => {
    expect(splashPhotoMotion(HOLD / 2, HOLD, 1).scale).toBe(1);
  });
});
