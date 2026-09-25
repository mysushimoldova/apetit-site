import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSplashVideoPool,
  FIRST_FRAME_WAIT,
  untilLevel,
  videoUsable,
} from "./videos";

// Правило загрузки (docs/motion/splash-prompt.md, раздел ЗАГРУЗКА): пока файл
// не загружен, заставка не играет. Ролики догружаются заранее, через
// секунду после отрисовки меню; нажатие ждёт недогруженный ролик не дольше 150 мс,
// потом переход к категории обычный.
//
// Уровни готовности <video> у браузера:
//   0 — ничего, 1 — только размеры, 2 — расшифрован текущий кадр,
//   3 — можно начать играть, 4 — хватит до конца.
//
// Раньше заставке хватало уровня 2, и это был баг: заставка начинала играть
// ролик, у которого есть один кадр, перематывала его на ноль и уходила в
// подкачку — на телефоне человек видел пустой кремовый экран вместо блюда.
describe("готовность ролика заставки", () => {
  it("играем только полностью загруженный ролик", () => {
    expect(videoUsable({ readyState: 4 })).toBe(true);
  });

  it("недогруженный ролик заставке не отдаём", () => {
    for (const readyState of [0, 1, 2, 3]) {
      expect(videoUsable({ readyState }), `readyState ${readyState}`).toBe(
        false,
      );
    }
  });
});

/** Поддельный <video>: уровень готовности двигает сам тест. */
class FakeVideo extends EventTarget {
  readyState = 0;
  src = "";
  muted = false;
  defaultMuted = false;
  playsInline = false;
  preload = "";
  loop = false;
  removed = false;
  setAttribute() {}
  removeAttribute() {}
  load() {}
  pause() {}
  remove() {
    this.removed = true;
  }
  /** Браузер дошёл до уровня level. */
  reach(level: number, type = "canplaythrough") {
    this.readyState = level;
    this.dispatchEvent(new Event(type));
  }
}

describe("ожидание уровня готовности", () => {
  it("уровень уже есть — сразу да", async () => {
    const video = new FakeVideo();
    video.readyState = 2;
    await expect(untilLevel(video, 2)).resolves.toBe(true);
  });

  it("ждёт, пока уровень дорастёт, а промежуточный не засчитывает", async () => {
    const video = new FakeVideo();
    let result: boolean | undefined;
    void untilLevel(video, 4).then((ok) => (result = ok));
    video.reach(2, "loadeddata");
    await Promise.resolve();
    expect(result).toBeUndefined();
    video.reach(4);
    await Promise.resolve();
    expect(result).toBe(true);
  });

  it("ошибка ролика — нет", async () => {
    const video = new FakeVideo();
    const result = untilLevel(video, 2);
    video.dispatchEvent(new Event("error"));
    await expect(result).resolves.toBe(false);
  });
});

// Вариант «б» (решение архитектора 25.09.2026): предзагрузка не только
// качает файл, но и сразу делает из него <video> и ждёт первый кадр — по
// одному ролику за раз. После первого кадра своя ссылка на файл убирается,
// но адрес blob: ролика остаётся открытым: Chrome через 20–30 с простоя
// усыпляет ролик и при нажатии перечитывает файл по этому адресу (замер
// 25.09.2026, см. шапку videos.ts).
describe("предзагрузка ролика", () => {
  let videos: FakeVideo[];
  let fetches: string[];
  let revoked: string[];
  const host = { appendChild: vi.fn() } as unknown as HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    videos = [];
    fetches = [];
    revoked = [];
    vi.stubGlobal("document", {
      createElement: () => {
        const video = new FakeVideo();
        videos.push(video);
        return video;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        fetches.push(url);
        return { ok: true, blob: async () => new Blob(["ролик"]) };
      }),
    );
    let next = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(
      () => `blob:ролик-${++next}`,
    );
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      revoked.push(url);
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Дать отработать цепочкам промисов. */
  const settle = () => vi.advanceTimersByTimeAsync(0);

  it("после скачивания сразу <video>, готово — на первом кадре", async () => {
    const pool = createSplashVideoPool(() => host);
    let done = false;
    void pool.preload("cola").then(() => (done = true));
    await settle();
    expect(fetches).toEqual(["/splash/cola.mp4"]);
    expect(videos).toHaveLength(1);
    expect(videos[0].src).toBe("blob:ролик-1");
    expect(done, "первого кадра ещё нет").toBe(false);

    videos[0].reach(2, "loadeddata");
    await settle();
    expect(done).toBe(true);
  });

  it("после первого кадра адрес ролика открыт, второй раз не качается", async () => {
    const pool = createSplashVideoPool(() => host);
    const preloaded = pool.preload("cola");
    await settle();
    videos[0].reach(2, "loadeddata");
    await preloaded;
    expect(revoked, "адрес нужен ролику и после простоя").toEqual([]);

    // Нажатие берёт тот же <video>, без нового скачивания
    videos[0].reach(4);
    await settle();
    expect(pool.take("cola")).toBe(videos[0]);
    expect(fetches).toHaveLength(1);
    expect(videos).toHaveLength(1);
  });

  it("первого кадра нет — очередь идёт дальше через FIRST_FRAME_WAIT", async () => {
    const pool = createSplashVideoPool(() => host);
    let done = false;
    void pool.preload("cola").then(() => (done = true));
    await settle();
    await vi.advanceTimersByTimeAsync(FIRST_FRAME_WAIT - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    // Ролик готовится дальше сам: кадр пришёл позже — ролик в запасе
    videos[0].reach(4);
    await settle();
    expect(pool.take("cola")).toBe(videos[0]);
    expect(fetches).toHaveLength(1);
  });

  it("нажатие опередило очередь — очередь не качает файл второй раз", async () => {
    const pool = createSplashVideoPool(() => host);
    expect(pool.take("cola")).toBe(null);
    await settle();
    videos[0].reach(2, "loadeddata");
    await settle();
    const preloaded = pool.preload("cola");
    await settle();
    await preloaded;
    expect(fetches).toHaveLength(1);
    expect(videos).toHaveLength(1);
  });

  it("ролик сломался после предзагрузки — следующее нажатие делает новый", async () => {
    const pool = createSplashVideoPool(() => host);
    const preloaded = pool.preload("cola");
    await settle();
    videos[0].reach(4);
    await preloaded;
    expect(pool.take("cola")).toBe(videos[0]);

    videos[0].dispatchEvent(new Event("error"));
    expect(videos[0].removed, "сломанный ролик убран из DOM").toBe(true);
    expect(revoked, "его адрес закрыт").toEqual(["blob:ролик-1"]);
    expect(pool.take("cola")).toBe(null);
    await settle();
    expect(videos).toHaveLength(2);
    expect(fetches, "файл берётся заново (из кеша браузера)").toHaveLength(2);
  });

  it("файл не разобрался — ролик забыт, адрес закрыт", async () => {
    const pool = createSplashVideoPool(() => host);
    const preloaded = pool.preload("cola");
    await settle();
    videos[0].dispatchEvent(new Event("error"));
    await preloaded;
    expect(videos[0].removed).toBe(true);
    expect(revoked).toEqual(["blob:ролик-1"]);
  });
});
