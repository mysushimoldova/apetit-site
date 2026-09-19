// Состояние корзины (Zustand). Почему Zustand, а не React context — см.
// PROGRESS.md: плитка подписывается только на своё число и не перерисовывается
// от чужих изменений, готовое сохранение в localStorage, стор доступен без React.
//
// Гидратация: skipHydration — сервер и первый рендер браузера видят пустую
// корзину (HTML совпадает), а CartProvider сразу после монтирования зовёт
// hydrateCart() и подставляет сохранённое.
import { useStore } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import { createStore } from "zustand/vanilla";
import type { CitySlug } from "@/data/points";
import {
  addLine,
  decrementProduct,
  parsePersistedCart,
  removeLine,
  setLineQty,
  type CartSnapshot,
  type LineConfig,
} from "./lines";
import { pruneLines, type Catalog } from "./pricing";

export const CART_STORAGE_KEY = "apetit.cart";

export interface CartState extends CartSnapshot {
  /** Сохранённая корзина уже подставлена (до этого корзина считается пустой). */
  hydrated: boolean;
  /** Счётчик добавлений — от него один раз подпрыгивает значок корзины. */
  bump: number;
  /** false — корзина принадлежит другому городу (сначала подтверждение). */
  add: (city: CitySlug, config: LineConfig, qty?: number) => boolean;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  /** «−» на плитке */
  decrementProduct: (productSlug: string) => void;
  /** «Golește coșul» и успешный заказ: все позиции убраны, город тот же. */
  clear: () => void;
  /** Смена города: корзина очищается и привязывается к новому городу. */
  switchCity: (city: CitySlug) => void;
  /** Убрать позиции, которые точка не продаёт. */
  prune: (catalog: Catalog) => void;
}

/** Синхронное хранилище «как localStorage» (подменяется в тестах). */
export type SyncStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * JSON-хранилище, которое никогда не бросает: нет localStorage (сервер,
 * запрет сайтам хранить данные) — корзина живёт в памяти вкладки;
 * битый JSON — как будто ничего не сохранено.
 */
function safeJsonStorage(
  getStorage: () => SyncStorage,
): PersistStorage<CartSnapshot> {
  const memory = new Map<string, string>();
  const real = (): SyncStorage | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };
  const read = (name: string): string | null => {
    try {
      const storage = real();
      if (storage) return storage.getItem(name);
    } catch {
      // чтение запрещено — берём из памяти
    }
    return memory.get(name) ?? null;
  };
  return {
    getItem(name) {
      const raw = read(name);
      if (raw === null) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    setItem(name, value) {
      const raw = JSON.stringify(value);
      memory.set(name, raw);
      try {
        real()?.setItem(name, raw);
      } catch {
        // нет места или запрещено — остаётся в памяти
      }
    },
    removeItem(name) {
      memory.delete(name);
      try {
        real()?.removeItem(name);
      } catch {
        // нечего удалять
      }
    },
  };
}

export function createCartStore(getStorage: () => SyncStorage) {
  return createStore<CartState>()(
    persist(
      (set, get, api) => ({
        city: null,
        lines: [],
        hydrated: false,
        bump: 0,

        add(city, config, qty = 1) {
          // Нажали «+» раньше, чем CartProvider подставил сохранённую корзину:
          // подставляем сейчас (localStorage синхронный), иначе затёрли бы её
          if (!get().hydrated) void api.persist.rehydrate();
          const s = get();
          if (s.lines.length > 0 && s.city !== city) return false;
          set({ city, lines: addLine(s.lines, config, qty), bump: s.bump + 1 });
          return true;
        },
        setQty(key, qty) {
          set({ lines: setLineQty(get().lines, key, qty) });
        },
        remove(key) {
          set({ lines: removeLine(get().lines, key) });
        },
        decrementProduct(productSlug) {
          set({ lines: decrementProduct(get().lines, productSlug) });
        },
        clear() {
          set({ lines: [] });
        },
        switchCity(city) {
          set({ city, lines: [] });
        },
        prune(catalog) {
          const lines = get().lines;
          const kept = pruneLines(lines, catalog);
          if (kept.length !== lines.length) set({ lines: kept });
        },
      }),
      {
        name: CART_STORAGE_KEY,
        version: 1,
        storage: safeJsonStorage(getStorage),
        // В хранилище — только город и позиции, без служебных полей
        partialize: ({ city, lines }) => ({ city, lines }),
        // Всё, что пришло из хранилища, проверяется (битое → пустая корзина)
        merge: (persisted, current) => ({
          ...current,
          ...parsePersistedCart(persisted),
          hydrated: true,
        }),
        skipHydration: true,
      },
    ),
  );
}

export type CartStore = ReturnType<typeof createCartStore>;

/** Подставить сохранённую корзину (и перечитать — при изменении в другой вкладке). */
export function hydrateCart(store: CartStore): void {
  void store.persist.rehydrate();
}

/** Корзина сайта. На сервере localStorage нет — там она просто пустая. */
export const cartStore = createCartStore(() => window.localStorage);

/** Подписка на часть корзины: компонент перерисуется, только если она изменилась. */
export function useCart<T>(selector: (state: CartState) => T): T {
  return useStore(cartStore, selector);
}
