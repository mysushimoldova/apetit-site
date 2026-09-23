// Список карточек блюд, которые сейчас на странице. Отдельный крошечный
// модуль — как src/motion/pause.ts и по той же причине: его импортирует
// каждая плитка меню (хук use-product-lift), и весь WebGL за собой он тянуть
// не должен. Слой движка (src/motion/layers/products.ts) подписывается сюда
// и раздаёт карточкам transform на каждом кадре.
//
// React-состояния здесь нет и быть не должно: кадр не имеет права трогать
// дерево компонентов.

/** Всё, что слой пишет элементу: только transform, opacity и will-change. */
export interface MotionStyleTarget {
  style: {
    transform: string;
    opacity: string;
    willChange: string;
  };
}

/** Одна карточка: блок фото (за ним следит наблюдатель видимости),
 *  само фото, группа теней и два её слоя. */
export interface ProductCard {
  box: Element;
  photo: MotionStyleTarget;
  shadow: MotionStyleTarget;
  ambient: MotionStyleTarget;
  contact: MotionStyleTarget;
}

const cards = new Set<ProductCard>();
const listeners = new Set<(card: ProductCard, added: boolean) => void>();

/** Добавить карточку. Возвращает снятие — его зовёт хук при размонтировании. */
export function registerProductCard(card: ProductCard): () => void {
  if (cards.has(card)) return () => unregister(card);
  cards.add(card);
  for (const listener of listeners) listener(card, true);
  return () => unregister(card);
}

function unregister(card: ProductCard): void {
  if (!cards.delete(card)) return;
  for (const listener of listeners) listener(card, false);
}

/** Карточки на странице сейчас. */
export function productCards(): ProductCard[] {
  return [...cards];
}

/** Подписка «карточка появилась / ушла». Возвращает отписку. */
export function onProductCardsChange(
  listener: (card: ProductCard, added: boolean) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Сброс — только для тестов. */
export function resetProductCards(): void {
  cards.clear();
  listeners.clear();
}
