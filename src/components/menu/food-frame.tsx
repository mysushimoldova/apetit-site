"use client";
// Рамка фото блюда: тень под фото и две обёртки вокруг самого фото — внешняя
// для появления, внутренняя для подъёма при прокрутке. Форма тени и переходы —
// в globals.css (.food-shadow, .food-reveal), числа приходят переменными CSS
// из src/config/motion.json.
//
// Обе тени (широкая и контактная) рисует один элемент двумя градиентами.
// Второй такой же элемент — та же тень, но как она выглядит на полном
// подъёме; в покое он полностью прозрачен и не рисуется вовсе, а при
// прокрутке движок перетекает из первого во второй. Поэтому он есть только
// там, где подъём вообще работает (плитка меню), и его нет в листе блюда.
//
// Компонент клиентский по одной причине: карточка сама записывается в список
// (src/motion/products-registry.ts), откуда её берёт слой движка. Список —
// несколько строк без WebGL, весь движок по-прежнему грузится отдельно и
// после показа страницы.
import { useEffect, useRef, type ReactNode } from "react";
import { registerProductCard } from "@/motion/products-registry";

export function FoodFrame({
  children,
  className = "",
  /** Плитка меню участвует в подъёме при прокрутке; лист блюда — нет:
   *  пока он открыт, движок всё равно стоит. */
  lift = false,
}: {
  children: ReactNode;
  className?: string;
  lift?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const rest = useRef<HTMLSpanElement>(null);
  const lifted = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!lift) return;
    const card = {
      box: box.current,
      photo: photo.current,
      shadow: shadow.current,
      rest: rest.current,
      lifted: lifted.current,
    };
    if (
      !card.box ||
      !card.photo ||
      !card.shadow ||
      !card.rest ||
      !card.lifted
    ) {
      return;
    }
    return registerProductCard({
      box: card.box,
      photo: card.photo,
      shadow: card.shadow,
      rest: card.rest,
      lifted: card.lifted,
    });
  }, [lift]);

  return (
    <div ref={box} className={`food ${className}`}>
      <div className="food-shadow" aria-hidden="true">
        <div ref={shadow} className="food-shadow-lift">
          <span ref={rest} className="food-shadow-layers food-shadow-rest" />
          {lift && (
            <span
              ref={lifted}
              className="food-shadow-layers food-shadow-lifted"
            />
          )}
        </div>
      </div>
      <div className="food-reveal">
        <div ref={photo} className="food-lift">
          {children}
        </div>
      </div>
    </div>
  );
}
