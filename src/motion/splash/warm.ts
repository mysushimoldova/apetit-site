// Какие ролики заставки держать «тёплыми» — с готовым первым кадром.
//
// Правило (решение архитектора 25.09.2026, ответ на вопрос 2 после B0):
// каждый тёплый ролик — свой декодер в видеокарте, поэтому их не больше
// splash.warmMax (по умолчанию 4). Тёплые — это категории, чьи чипы сейчас
// видны в ленте, плюс последняя открытая; последняя — первой, потом
// видимые слева направо. Файлы при этом скачаны у всех категорий точки
// (videos.ts), так что согреть ролик можно без сети.
//
//  • Лента прокрутилась — через WARM_DELAY набор обновляется: выпавшие
//    отпускают декодер сразу, новые греются по одному.
//  • Нажатие на холодный чип — по обычному правилу заставки: ждём ролик не
//    дольше 150 мс, иначе обычный переход (controller.ts).
//  • Вкладка ушла в фон — отпускаются все; вернулась — видимые греются
//    снова.
//
// Отдельный модуль без DOM: весь порядок проверяет тест (warm.test.ts).

/** Через сколько после прокрутки ленты обновляется набор тёплых роликов,
 *  мс (решение архитектора 25.09.2026). Правило загрузки, не вид
 *  заставки, — поэтому не в motion.json. */
export const WARM_DELAY = 300;

/**
 * Ролики, которые должны быть тёплыми: последняя открытая категория, потом
 * видимые слева направо, не больше max. Категории без ролика (там играет
 * фото) места не занимают.
 */
export function warmTargets(
  visible: readonly string[],
  last: string | null,
  max: number,
  videoFor: (category: string) => string | null,
): string[] {
  const slugs: string[] = [];
  for (const category of last ? [last, ...visible] : visible) {
    if (slugs.length >= max) break;
    const slug = videoFor(category);
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

/** Что хранителю нужно от запаса роликов (videos.ts). */
export interface WarmPool {
  hasFile(slug: string): boolean;
  warm(slug: string): Promise<void>;
  release(slug: string): void;
  warmSlugs(): string[];
}

export interface WarmKeeper {
  /** Лента сообщила видимые чипы — набор обновится через WARM_DELAY. */
  setVisible(categories: readonly string[]): void;
  /** Открыта категория — она тёплая в первую очередь. */
  opened(category: string): void;
  /** Поменялась настройка warmMax — набор обновится через WARM_DELAY. */
  refresh(): void;
  /** Обновить набор сейчас. Готово, когда согреты все, чей файл уже
   *  скачан, — так предзагрузка не качает следующий файл, пока идёт
   *  разбор. */
  settle(): Promise<void>;
  /** Вкладка ушла в фон: отпустить все декодеры. */
  hide(): void;
  /** Вкладка вернулась: согреть нужные снова. */
  show(): void;
  dispose(): void;
}

export function createWarmKeeper(deps: {
  pool: WarmPool;
  /** Ролик категории в этой точке; нет — null. */
  videoFor: (category: string) => string | null;
  /** Сколько роликов держать тёплыми (splash.warmMax). */
  max: () => number;
  /** Ролик, который заставка рисует прямо сейчас: его не отпускаем, даже
   *  если он выпал из набора, — иначе на экране останется пустой кадр. */
  busy?: () => string | null;
}): WarmKeeper {
  const { pool } = deps;
  let visible: readonly string[] = [];
  let last: string | null = null;
  let hidden = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Идёт согрев: по одному ролику за раз. */
  let warming: Promise<void> | null = null;

  const targets = () =>
    warmTargets(visible, last, Math.max(0, deps.max()), deps.videoFor);

  /** Следующий ролик, который надо согреть: нужен, скачан и ещё холодный.
   *  tried — уже взятые в этом заходе: не разобравшийся ролик не греем по
   *  кругу. */
  function nextCold(tried: ReadonlySet<string>): string | undefined {
    const warm = pool.warmSlugs();
    return targets().find(
      (slug) => pool.hasFile(slug) && !warm.includes(slug) && !tried.has(slug),
    );
  }

  /** Греть по одному, пока есть кого. Набор перечитывается перед каждым
   *  роликом: пока грелся один, лента могла уехать. */
  function pump(): Promise<void> {
    if (warming) return warming;
    const loop = async () => {
      const tried = new Set<string>();
      for (;;) {
        if (disposed || hidden) return;
        const slug = nextCold(tried);
        if (!slug) return;
        tried.add(slug);
        await pool.warm(slug);
      }
    };
    const run = loop().finally(() => {
      if (warming === run) warming = null;
    });
    warming = run;
    return run;
  }

  function reconcile(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    if (disposed || hidden) return Promise.resolve();
    const wanted = targets();
    const busy = deps.busy?.() ?? null;
    for (const slug of pool.warmSlugs()) {
      if (!wanted.includes(slug) && slug !== busy) pool.release(slug);
    }
    return pump();
  }

  function later(): void {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(() => void reconcile(), WARM_DELAY);
  }

  return {
    setVisible(categories) {
      visible = [...categories];
      later();
    },
    opened(category) {
      last = category;
      later();
    },
    refresh: later,
    settle: reconcile,
    hide() {
      hidden = true;
      clearTimeout(timer);
      timer = undefined;
      for (const slug of pool.warmSlugs()) pool.release(slug);
    },
    show() {
      hidden = false;
      void reconcile();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
