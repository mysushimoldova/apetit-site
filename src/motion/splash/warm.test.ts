import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWarmKeeper,
  WARM_DELAY,
  warmTargets,
  type WarmPool,
} from "./warm";

// Тёплые ролики (решение архитектора 25.09.2026, ответ на вопрос 2 после
// B0): не больше warmMax; тёплые — видимые в ленте чипы и последняя
// открытая категория. Лента прокрутилась — через 300 мс набор обновляется:
// выпавшие отпускают декодер, новые греются по одному. Вкладка в фоне —
// отпущены все; вернулась — видимые греются снова.

/** Ролик категории в точке; у pizza ролика нет — там играет фото. */
const VIDEO: Record<string, string | null> = {
  kebab: "kebab-xl",
  burgers: "cheeseburger",
  gozleme: "gozleme-carne",
  sandwich: "sandwich-salam",
  pizza: null,
  drinks: "cola",
  desert: "brinzoaice",
};
const videoFor = (category: string) => VIDEO[category] ?? null;

describe("какие ролики тёплые", () => {
  it("видимые слева направо, не больше max", () => {
    expect(
      warmTargets(
        ["kebab", "burgers", "gozleme", "sandwich", "drinks"],
        null,
        4,
        videoFor,
      ),
    ).toEqual(["kebab-xl", "cheeseburger", "gozleme-carne", "sandwich-salam"]);
  });

  it("последняя открытая — первой, даже если её чип уехал", () => {
    expect(
      warmTargets(
        ["kebab", "burgers", "gozleme", "sandwich"],
        "desert",
        4,
        videoFor,
      ),
    ).toEqual(["brinzoaice", "kebab-xl", "cheeseburger", "gozleme-carne"]);
  });

  it("открытая и видимая одновременно считается один раз", () => {
    expect(warmTargets(["kebab", "burgers"], "burgers", 4, videoFor)).toEqual([
      "cheeseburger",
      "kebab-xl",
    ]);
  });

  it("категория с фото места не занимает", () => {
    expect(
      warmTargets(["pizza", "kebab", "burgers"], "pizza", 2, videoFor),
    ).toEqual(["kebab-xl", "cheeseburger"]);
  });
});

/** Поддельный запас роликов: первый кадр «приходит», когда скажет тест. */
function fakePool(files: string[]) {
  const downloaded = new Set(files);
  const warm = new Set<string>();
  const log: string[] = [];
  const frames = new Map<string, () => void>();
  const pool: WarmPool = {
    hasFile: (slug) => downloaded.has(slug),
    warm(slug) {
      log.push(`+${slug}`);
      warm.add(slug);
      return new Promise((resolve) => frames.set(slug, resolve));
    },
    release(slug) {
      log.push(`-${slug}`);
      warm.delete(slug);
      frames.get(slug)?.();
    },
    warmSlugs: () => [...warm],
  };
  return {
    pool,
    log,
    downloaded,
    warm,
    /** У ролика появился первый кадр. */
    frame: async (slug: string) => {
      frames.get(slug)?.();
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

const ALL = [
  "kebab-xl",
  "cheeseburger",
  "gozleme-carne",
  "sandwich-salam",
  "cola",
  "brinzoaice",
];

describe("хранитель тёплых роликов", () => {
  let max = 4;
  beforeEach(() => {
    vi.useFakeTimers();
    max = 4;
  });
  afterEach(() => vi.useRealTimers());

  const keeperFor = (fake: ReturnType<typeof fakePool>) =>
    createWarmKeeper({ pool: fake.pool, videoFor, max: () => max });

  it("лента прокрутилась — набор обновляется через 300 мс, не раньше", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY - 1);
    expect(fake.log).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.log).toEqual(["+kebab-xl"]);
  });

  it("новые греются по одному: следующий — после первого кадра предыдущего", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers", "gozleme"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect(fake.log).toEqual(["+kebab-xl"]);
    await fake.frame("kebab-xl");
    expect(fake.log).toEqual(["+kebab-xl", "+cheeseburger"]);
    await fake.frame("cheeseburger");
    await fake.frame("gozleme-carne");
    expect(fake.log).toEqual(["+kebab-xl", "+cheeseburger", "+gozleme-carne"]);
  });

  it("выпавшие из ленты отпускают декодер, их файл не трогается", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    await fake.frame("kebab-xl");
    await fake.frame("cheeseburger");

    keeper.setVisible(["gozleme", "sandwich"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect(fake.log.slice(2)).toEqual([
      "-kebab-xl",
      "-cheeseburger",
      "+gozleme-carne",
    ]);
    expect(fake.downloaded.has("kebab-xl")).toBe(true);
  });

  it("быстрая прокрутка: считается только то, где лента остановилась", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab"]);
    await vi.advanceTimersByTimeAsync(100);
    keeper.setVisible(["burgers"]);
    await vi.advanceTimersByTimeAsync(100);
    keeper.setVisible(["drinks"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect(fake.log).toEqual(["+cola"]);
  });

  it("не больше warmMax, последняя открытая — в их числе", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers", "gozleme", "sandwich"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    for (const slug of [
      "kebab-xl",
      "cheeseburger",
      "gozleme-carne",
      "sandwich-salam",
    ]) {
      await fake.frame(slug);
    }
    expect(fake.warm.size).toBe(4);

    // Открыли десерты (нажатие само начинает греть ролик — как в заставке)
    fake.pool.warm("brinzoaice");
    keeper.opened("desert");
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect(fake.log.at(-1), "крайний правый видимый уступил место").toBe(
      "-sandwich-salam",
    );
    expect([...fake.warm].sort()).toEqual(
      ["brinzoaice", "cheeseburger", "gozleme-carne", "kebab-xl"].sort(),
    );
  });

  it("warmMax поменяли в панели — набор пересчитан", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers", "gozleme"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    for (const slug of ["kebab-xl", "cheeseburger", "gozleme-carne"]) {
      await fake.frame(slug);
    }
    max = 1;
    keeper.refresh();
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect([...fake.warm]).toEqual(["kebab-xl"]);
  });

  it("греются только скачанные; settle после скачивания догревает", async () => {
    const fake = fakePool([]);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect(fake.log, "файлов ещё нет").toEqual([]);

    fake.downloaded.add("cheeseburger");
    let settled = false;
    void keeper.settle().then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.log).toEqual(["+cheeseburger"]);
    expect(settled, "ждёт первого кадра").toBe(false);
    await fake.frame("cheeseburger");
    expect(settled).toBe(true);
  });

  it("не видимый и не открытый — не греется, даже если скачан", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab"]);
    void keeper.settle();
    await vi.advanceTimersByTimeAsync(0);
    await fake.frame("kebab-xl");
    expect(fake.log).toEqual(["+kebab-xl"]);
  });

  it("вкладка в фоне — отпущены все; вернулась — видимые греются сразу", async () => {
    const fake = fakePool(ALL);
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    await fake.frame("kebab-xl");
    await fake.frame("cheeseburger");

    keeper.hide();
    expect(fake.warm.size).toBe(0);
    // В фоне ничего не греется: ни лента, ни скачанный файл
    keeper.setVisible(["drinks"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    await keeper.settle();
    expect(fake.warm.size).toBe(0);

    keeper.show();
    await vi.advanceTimersByTimeAsync(0);
    expect([...fake.warm]).toEqual(["cola"]);
  });

  it("ролик не разобрался — второй раз в том же заходе не берётся", async () => {
    const fake = fakePool(ALL);
    // Сломанный ролик: согрев сразу кончается, а <video> у него не остаётся
    const broken = fake.pool.warm;
    let attempts = 0;
    fake.pool.warm = (slug) => {
      if (slug !== "kebab-xl") return broken(slug);
      attempts++;
      return Promise.resolve();
    };
    const keeper = keeperFor(fake);
    keeper.setVisible(["kebab", "burgers"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    await fake.frame("cheeseburger");
    expect(attempts).toBe(1);
    expect(fake.log).toEqual(["+cheeseburger"]);
  });
  it("ролик на экране заставки не отпускается, даже выпав из набора", async () => {
    const fake = fakePool(ALL);
    let busy: string | null = "kebab-xl";
    const keeper = createWarmKeeper({
      pool: fake.pool,
      videoFor,
      max: () => max,
      busy: () => busy,
    });
    keeper.setVisible(["kebab"]);
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    await fake.frame("kebab-xl");

    // Нажали другой чип, а заставка кебаба ещё на экране
    keeper.opened("drinks");
    keeper.setVisible(["drinks"]);
    void keeper.settle();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.warm.has("kebab-xl"), "рисуется — не отпускаем").toBe(true);

    // Заставка ушла — в следующий пересчёт отпускается
    busy = null;
    keeper.refresh();
    await vi.advanceTimersByTimeAsync(WARM_DELAY);
    expect(fake.warm.has("kebab-xl")).toBe(false);
  });
});
