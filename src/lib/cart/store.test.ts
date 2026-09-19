import { beforeEach, describe, expect, it } from "vitest";
import { lineKey, type LineConfig } from "./lines";
import {
  CART_STORAGE_KEY,
  createCartStore,
  hydrateCart,
  type SyncStorage,
} from "./store";

/** Хранилище «как localStorage», общее для нескольких «вкладок». */
function memoryStorage(): SyncStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const kebab: LineConfig = {
  productSlug: "kebab-xl-xxl",
  variantId: "xxl",
  addonIds: ["sos-usturoi"],
  removedIds: [],
};
const cola: LineConfig = {
  productSlug: "cola",
  variantId: null,
  addonIds: [],
  removedIds: [],
};

let storage: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  storage = memoryStorage();
});

function hydratedStore() {
  const store = createCartStore(() => storage);
  hydrateCart(store);
  return store;
}

describe("корзина и город", () => {
  it("«+» раньше восстановления: сначала подставляется сохранённое, потом добавляется", () => {
    hydratedStore().getState().add("soroca", kebab);
    const store = createCartStore(() => storage);
    expect(store.getState().hydrated).toBe(false);
    expect(store.getState().add("soroca", cola)).toBe(true);
    expect(store.getState().lines.map((l) => l.productSlug)).toEqual([
      "kebab-xl-xxl",
      "cola",
    ]);
  });

  it("ранний «+» в другом городе не затирает сохранённую корзину", () => {
    hydratedStore().getState().add("soroca", kebab);
    const store = createCartStore(() => storage);
    expect(store.getState().add("briceni", cola)).toBe(false);
    expect(store.getState().city).toBe("soroca");
    expect(store.getState().lines).toHaveLength(1);
  });

  it("первое добавление привязывает корзину к городу", () => {
    const store = hydratedStore();
    expect(store.getState().add("soroca", kebab, 2)).toBe(true);
    expect(store.getState().city).toBe("soroca");
    expect(store.getState().lines).toEqual([{ ...kebab, qty: 2 }]);
  });

  it("одинаковая конфигурация складывается", () => {
    const store = hydratedStore();
    store.getState().add("soroca", kebab);
    store.getState().add("soroca", kebab, 2);
    expect(store.getState().lines).toHaveLength(1);
    expect(store.getState().lines[0].qty).toBe(3);
  });

  it("чужой город при непустой корзине — отказ, корзина цела", () => {
    const store = hydratedStore();
    store.getState().add("soroca", kebab);
    expect(store.getState().add("briceni", cola)).toBe(false);
    expect(store.getState().city).toBe("soroca");
    expect(store.getState().lines).toHaveLength(1);
  });

  it("смена города очищает корзину и привязывает к новому", () => {
    const store = hydratedStore();
    store.getState().add("soroca", kebab);
    store.getState().switchCity("briceni");
    expect(store.getState().city).toBe("briceni");
    expect(store.getState().lines).toEqual([]);
    expect(store.getState().add("briceni", cola)).toBe(true);
  });

  it("пустая корзина другого города — добавление просто переносит её", () => {
    const store = hydratedStore();
    store.getState().add("soroca", cola);
    store.getState().remove(lineKey(cola));
    expect(store.getState().lines).toEqual([]);
    expect(store.getState().add("otaci", cola)).toBe(true);
    expect(store.getState().city).toBe("otaci");
  });
});

describe("действия с позициями", () => {
  it("setQty, decrementProduct и remove", () => {
    const store = hydratedStore();
    store.getState().add("soroca", cola);
    const key = lineKey(cola);
    store.getState().setQty(key, 5);
    expect(store.getState().lines[0].qty).toBe(5);
    store.getState().decrementProduct("cola");
    expect(store.getState().lines[0].qty).toBe(4);
    store.getState().remove(key);
    expect(store.getState().lines).toEqual([]);
  });

  it("clear: все позиции убраны, город остаётся, сохранено", () => {
    const store = hydratedStore();
    store.getState().add("soroca", cola);
    store.getState().add("soroca", kebab, 2);
    store.getState().clear();
    expect(store.getState()).toMatchObject({ city: "soroca", lines: [] });
    expect(JSON.parse(storage.data.get(CART_STORAGE_KEY)!).state).toEqual({
      city: "soroca",
      lines: [],
    });
  });

  it("bump растёт на каждое добавление и не сохраняется", () => {
    const store = hydratedStore();
    store.getState().add("soroca", cola);
    store.getState().add("soroca", cola);
    expect(store.getState().bump).toBe(2);
    const saved = JSON.parse(storage.data.get(CART_STORAGE_KEY)!);
    expect(Object.keys(saved.state).sort()).toEqual(["city", "lines"]);
  });
});

describe("хранение в localStorage", () => {
  it("корзина переживает перезагрузку страницы", () => {
    hydratedStore().getState().add("soroca", kebab, 2);
    const reloaded = hydratedStore();
    expect(reloaded.getState().city).toBe("soroca");
    expect(reloaded.getState().lines).toEqual([{ ...kebab, qty: 2 }]);
  });

  it("мусор в хранилище → пустая корзина, без ошибок", () => {
    storage.data.set(CART_STORAGE_KEY, "{не json");
    expect(hydratedStore().getState().lines).toEqual([]);
    storage.data.set(
      CART_STORAGE_KEY,
      JSON.stringify({
        state: { city: "soroca", lines: [{ qty: -1 }] },
        version: 1,
      }),
    );
    const store = hydratedStore();
    expect(store.getState().lines).toEqual([]);
    expect(store.getState().hydrated).toBe(true);
  });

  it("вторая вкладка после rehydrate видит позиции первой", () => {
    const tabA = hydratedStore();
    const tabB = hydratedStore();
    tabA.getState().add("soroca", kebab);
    // событие storage во второй вкладке → rehydrate
    tabB.persist.rehydrate();
    tabB.getState().add("soroca", cola);
    expect(tabB.getState().lines.map((l) => l.productSlug)).toEqual([
      "kebab-xl-xxl",
      "cola",
    ]);
  });

  it("хранилище недоступно (приватный режим) — корзина работает в памяти", () => {
    const store = createCartStore(() => {
      throw new Error("SecurityError");
    });
    hydrateCart(store);
    expect(store.getState().add("soroca", cola)).toBe(true);
    expect(store.getState().lines).toHaveLength(1);
  });
});
