// Слой карточек блюд: «aterizare» — при прокрутке фото приподнимается и чуть
// растёт, контактная тень уходит, широкая расплывается; страница встала —
// фото спокойно садится на место (DESIGN.md → Product Tile, Motion).
//
// Слой живёт в движке (src/motion/engine.ts) наравне с фоном, но ничего не
// рисует на холсте: он берёт тик и время кадра и пишет transform живым
// элементам страницы. Так подъём останавливается там же, где и фон: спрятана
// вкладка, открыт лист блюда или корзина, страница едет к категории,
// «уменьшить движение», самый низкий уровень качества.
//
// Чего слой не делает:
//  • не трогает раскладку — только transform и opacity, поэтому CLS = 0;
//  • не зовёт getBoundingClientRect на кадре: кто в экране, помнит
//    IntersectionObserver (иначе 47 плиток заставили бы браузер пересчитывать
//    раскладку по нескольку раз за кадр);
//  • не трогает React: карточки приходят из списка (products-registry.ts).
import type { ProductsSettings } from "../config-schema";
import {
  liftAtRest,
  liftFrame,
  restLift,
  stepLift,
  type LiftState,
} from "../lift";
import { onMotionPauseChange } from "../pause";
import {
  onProductCardsChange,
  productCards,
  type ProductCard,
} from "../products-registry";
import type { Frame, GL, Layer } from "../types";

/** Насколько выше и ниже экрана карточки ещё считаются видимыми. */
const VIEWPORT_MARGIN_PX = 200;

export interface ProductsLayer extends Layer {
  setSettings(settings: ProductsSettings): void;
}

export function createProductsLayer(settings: ProductsSettings): ProductsLayer {
  let current = settings;
  let state: LiftState = restLift();
  /** Карточки, которые сейчас в экране (± запас). */
  const visible = new Set<ProductCard>();
  /** Кому уже поставлен will-change. */
  const marked = new Set<ProductCard>();
  const byBox = new Map<Element, ProductCard>();
  let observer: IntersectionObserver | null = null;
  const cleanups: (() => void)[] = [];
  /** Всё уже стоит на месте, инлайновые стили сняты. */
  let settled = true;
  /** После паузы прокрутка могла уехать далеко (страница ехала к категории).
   *  Первый кадр после этого начинаем с того места, где стоим, иначе разница
   *  превратилась бы в огромную скорость и фото подпрыгнуло бы. */
  let resync = true;

  const watch = (card: ProductCard) => {
    byBox.set(card.box, card);
    if (observer) observer.observe(card.box);
    // Без IntersectionObserver (старый браузер, тесты) считаем видимыми все:
    // лишние записи в style дешевле, чем неработающий эффект
    else visible.add(card);
  };

  const unwatch = (card: ProductCard) => {
    byBox.delete(card.box);
    visible.delete(card);
    marked.delete(card);
    observer?.unobserve(card.box);
  };

  /** Снять всё, что слой написал: страница выглядит как без него. */
  const rest = () => {
    state = restLift(state.scroll);
    settled = true;
    resync = true;
    marked.clear();
    for (const card of productCards()) {
      card.photo.style.transform = "";
      card.photo.style.willChange = "";
      card.shadow.style.transform = "";
      card.shadow.style.willChange = "";
      card.rest.style.opacity = "";
      card.rest.style.willChange = "";
      card.lifted.style.opacity = "";
      card.lifted.style.willChange = "";
    }
  };

  return {
    id: "products",
    // Порядок среди слоёв движка не важен: на холсте этот слой не рисует
    zIndex: 10,

    init() {
      if (typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const card = byBox.get(entry.target);
              if (!card) continue;
              if (entry.isIntersecting) visible.add(card);
              else visible.delete(card);
            }
          },
          {
            rootMargin: `${VIEWPORT_MARGIN_PX}px 0px ${VIEWPORT_MARGIN_PX}px 0px`,
          },
        );
      }
      for (const card of productCards()) watch(card);
      cleanups.push(
        onProductCardsChange((card, added) => {
          if (added) watch(card);
          else unwatch(card);
        }),
      );
      // Движок встал (лист блюда, корзина, спрятанная вкладка) — кадров
      // больше не будет, и снять поднятое фото больше некому
      cleanups.push(
        onMotionPauseChange((paused) => {
          if (paused) rest();
        }),
      );
    },

    render(_gl: GL, frame: Frame) {
      const lift = current.lift;
      if (resync) {
        state = restLift(frame.scrollY);
        resync = false;
      }
      state = stepLift(state, frame.scrollY, frame.dt, lift);
      if (!lift.enabled || liftAtRest(state)) {
        if (!settled) rest();
        return;
      }
      settled = false;
      const values = liftFrame(state, lift);
      // Имена нарочно не rest/lifted: rest() выше — это снятие стилей
      const liftedOpacity = values.mix.toFixed(3);
      const restOpacity = (1 - values.mix).toFixed(3);
      for (const card of visible) {
        // will-change — обещание браузеру, а не значение: ставим один раз на
        // движение и снимаем в покое (rest), а не переписываем каждый кадр.
        // Тени обещают opacity: тогда перетекание одной в другую целиком
        // достаётся композитору и градиенты не перерисовываются.
        if (!marked.has(card)) {
          marked.add(card);
          card.photo.style.willChange = "transform";
          card.shadow.style.willChange = "transform";
          card.rest.style.willChange = "opacity";
          card.lifted.style.willChange = "opacity";
        }
        card.photo.style.transform = values.photo;
        card.shadow.style.transform = values.shadow;
        card.rest.style.opacity = restOpacity;
        card.lifted.style.opacity = liftedOpacity;
      }
    },

    setSettings(next: ProductsSettings) {
      current = next;
      if (!next.lift.enabled) rest();
    },

    dispose() {
      for (const off of cleanups) off();
      cleanups.length = 0;
      observer?.disconnect();
      observer = null;
      byBox.clear();
      visible.clear();
      marked.clear();
      rest();
    },
  };
}
