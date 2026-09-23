import { afterEach, describe, expect, it } from "vitest";
import type { ProductsSettings } from "../config-schema";
import { pauseMotion, resetMotionPauses, resumeMotion } from "../pause";
import {
  productCards,
  registerProductCard,
  resetProductCards,
  type ProductCard,
} from "../products-registry";
import type { Frame, GL } from "../types";
import { createProductsLayer } from "./products";

const SETTINGS: ProductsSettings = {
  shadow: {
    aw: 93,
    ah: 29,
    ab: 34,
    aa: 0.11,
    cw: 82,
    ch: 18,
    cb: 13,
    ca: 0.29,
    y: 3,
    tint: 0.25,
  },
  reveal: { type: "lift", dur: 360, dist: 14, stagger: 70, shadowDelay: 100 },
  lift: {
    enabled: true,
    amt: 0.9,
    smooth: 0.13,
    shadowReact: 0.7,
    rise: 7,
    sensitivity: 12,
    settle: 130,
    grow: 1.5,
    tilt: 1,
  },
};

/** Элемент, от которого слою нужен только style. */
const el = () => ({ style: { transform: "", opacity: "", willChange: "" } });

function card(name: string): ProductCard {
  return {
    box: { name } as unknown as Element,
    photo: el(),
    shadow: el(),
    rest: el(),
    lifted: el(),
  };
}

/** В тестах нет ни WebGL, ни IntersectionObserver — слою они и не нужны. */
const gl = null as unknown as GL;

function frame(scrollY: number, dt = 16.67): Frame {
  return {
    t: 0,
    dt,
    width: 390,
    height: 844,
    dpr: 1,
    scroll: scrollY,
    scrollY,
    quality: 1,
  };
}

/** Прокрутить страницу на speed px за кадр. */
function scroll(
  layer: ReturnType<typeof createProductsLayer>,
  speed: number,
  frames: number,
): number {
  let y = 0;
  for (let i = 0; i < frames; i++) {
    y += speed;
    layer.render(gl, frame(y));
  }
  return y;
}

afterEach(() => {
  resetProductCards();
  resetMotionPauses();
});

describe("слой карточек блюд", () => {
  it("берёт карточки, которые уже есть, и новые", () => {
    const first = card("first");
    registerProductCard(first);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);

    scroll(layer, 40, 10);
    expect(first.photo.style.transform).not.toBe("");

    const second = card("second");
    registerProductCard(second);
    scroll(layer, 40, 4);
    expect(second.photo.style.transform).not.toBe("");
    layer.dispose(gl);
  });

  it("снятая карточка больше не получает кадров", () => {
    const one = card("one");
    const off = registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);
    scroll(layer, 40, 10);
    const lifted = one.photo.style.transform;
    expect(lifted).not.toBe("");

    off();
    expect(productCards()).toEqual([]);
    scroll(layer, 40, 10);
    // Значение осталось тем, что было на последнем кадре: элемент уже не наш
    expect(one.photo.style.transform).toBe(lifted);
    layer.dispose(gl);
  });

  it("снятие второй раз безвредно", () => {
    const one = card("one");
    const off = registerProductCard(one);
    off();
    off();
    expect(productCards()).toEqual([]);
  });

  it("поднимает фото и приглушает контактную тень", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);

    scroll(layer, 40, 12);
    expect(one.photo.style.transform).toContain("translate3d");
    expect(one.photo.style.willChange).toBe("transform");
    expect(one.shadow.style.transform).toContain("scaleX");
    // Тень перетекает из покоя в поднятую: вместе прозрачности дают единицу
    expect(one.rest.style.willChange).toBe("opacity");
    expect(Number(one.lifted.style.opacity)).toBeGreaterThan(0);
    expect(
      Number(one.rest.style.opacity) + Number(one.lifted.style.opacity),
    ).toBeCloseTo(1, 3);
    layer.dispose(gl);
  });

  it("когда всё успокоилось — снимает свои стили и will-change", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);

    const y = scroll(layer, 40, 12);
    expect(one.photo.style.transform).not.toBe("");
    for (let i = 0; i < 120; i++) layer.render(gl, frame(y));
    expect(one.photo.style.transform).toBe("");
    expect(one.photo.style.willChange).toBe("");
    expect(one.shadow.style.transform).toBe("");
    expect(one.rest.style.opacity).toBe("");
    expect(one.rest.style.willChange).toBe("");
    expect(one.lifted.style.opacity).toBe("");
    layer.dispose(gl);
  });

  it("пауза движка снимает подъём сразу же", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);
    scroll(layer, 40, 12);
    expect(one.photo.style.transform).not.toBe("");

    pauseMotion("sheet");
    expect(one.photo.style.transform).toBe("");
    expect(one.photo.style.willChange).toBe("");
    resumeMotion("sheet");
    layer.dispose(gl);
  });

  it("после паузы прокрутка не превращается в прыжок", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);
    scroll(layer, 40, 12);
    pauseMotion("scroll");
    resumeMotion("scroll");
    // Страница уехала на 4000 px, пока движок стоял
    layer.render(gl, frame(4000));
    expect(one.photo.style.transform).toBe("");
  });

  it("выключенный эффект не трогает карточки", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer({
      ...SETTINGS,
      lift: { ...SETTINGS.lift, enabled: false },
    });
    layer.init(gl);
    scroll(layer, 40, 20);
    expect(one.photo.style.transform).toBe("");
    expect(one.lifted.style.opacity).toBe("");
    layer.dispose(gl);
  });

  it("выключение на ходу снимает уже поднятое", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);
    scroll(layer, 40, 12);
    expect(one.photo.style.transform).not.toBe("");

    layer.setSettings({
      ...SETTINGS,
      lift: { ...SETTINGS.lift, enabled: false },
    });
    expect(one.photo.style.transform).toBe("");
    layer.dispose(gl);
  });

  it("новые настройки применяются на следующем кадре", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);
    scroll(layer, 40, 12);
    const before = one.photo.style.transform;

    layer.setSettings({
      ...SETTINGS,
      lift: { ...SETTINGS.lift, rise: 18, amt: 2 },
    });
    scroll(layer, 40, 1);
    expect(one.photo.style.transform).not.toBe(before);
    layer.dispose(gl);
  });

  it("разборка слоя снимает всё и отписывается от списка", () => {
    const one = card("one");
    registerProductCard(one);
    const layer = createProductsLayer(SETTINGS);
    layer.init(gl);
    scroll(layer, 40, 12);
    layer.dispose(gl);
    expect(one.photo.style.transform).toBe("");

    // После разборки новые карточки слою уже не приходят
    const two = card("two");
    registerProductCard(two);
    scroll(layer, 40, 10);
    expect(two.photo.style.transform).toBe("");
  });
});
