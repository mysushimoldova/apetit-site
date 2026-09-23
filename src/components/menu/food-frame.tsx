"use client";
// Рамка фото блюда: два слоя тени под фото и две обёртки вокруг самого фото —
// внешняя для появления, внутренняя для подъёма при прокрутке. Форма тени и
// переходы — в globals.css (.food-shadow, .food-reveal), числа приходят
// переменными CSS из src/config/motion.json.
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
  const ambient = useRef<HTMLSpanElement>(null);
  const contact = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!lift) return;
    const card = {
      box: box.current,
      photo: photo.current,
      shadow: shadow.current,
      ambient: ambient.current,
      contact: contact.current,
    };
    if (
      !card.box ||
      !card.photo ||
      !card.shadow ||
      !card.ambient ||
      !card.contact
    ) {
      return;
    }
    return registerProductCard({
      box: card.box,
      photo: card.photo,
      shadow: card.shadow,
      ambient: card.ambient,
      contact: card.contact,
    });
  }, [lift]);

  return (
    <div ref={box} className={`food ${className}`}>
      <div className="food-shadow" aria-hidden="true">
        <div ref={shadow} className="food-shadow-lift">
          <span ref={ambient} className="food-shadow-ambient" />
          <span ref={contact} className="food-shadow-contact" />
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
