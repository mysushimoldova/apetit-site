"use client";
// Название блюда — кнопка «открыть лист». Её невидимая зона растянута на всю
// плитку (globals.css → .tile-open::after): нажатие на фото или название
// открывает лист, а в табуляции у плитки одна остановка.
import { useCartContext } from "@/components/cart/cart-context";

export function TileOpenButton({ slug, name }: { slug: string; name: string }) {
  const { openProduct } = useCartContext();
  return (
    <button
      type="button"
      className="tile-open block w-full touch-manipulation"
      onClick={() => openProduct(slug)}
    >
      <span className="line-clamp-2">{name}</span>
    </button>
  );
}
