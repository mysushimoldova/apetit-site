// Плитка блюда (DESIGN.md → Product Tile): без поверхности, рамки и тени.
// Фото → название (2 строки) → состав (2 строки, «…») → граммы → ценник и «+».
// Нажатие на фото/название откроет лист блюда — следующая задача.
import { Plus } from "lucide-react";
import type { Locale } from "@/data/points";
import { priceLabel, type MenuProduct } from "@/data/menu";
import type { Messages } from "@/i18n/messages";
import { FoodImage } from "./food-image";

/** «440 g», «340 / 430 g» при вариантах; null — граммов нет. */
function gramsLabel(product: MenuProduct, unit: string): string | null {
  const variantGrams = product.variants
    ?.map((v) => v.grams)
    .filter((g): g is number => g !== null);
  const unique = [...new Set(variantGrams)];
  if (unique.length > 1) return `${unique.join(" / ")} ${unit}`;
  const grams = unique[0] ?? product.grams;
  return grams ? `${grams} ${unit}` : null;
}

export function ProductTile({
  product,
  locale,
  t,
  eager,
}: {
  product: MenuProduct;
  locale: Locale;
  t: Messages;
  eager?: boolean;
}) {
  const name = product.name[locale];
  const ingredients = product.ingredients[locale].join(", ");
  const grams = gramsLabel(product, t.menu.grams);
  const { from, price } = priceLabel(product);

  return (
    <article data-reveal className="flex min-w-0 flex-col">
      <FoodImage photo={product.photo} alt={name} eager={eager} />
      <h3 className="mt-4 line-clamp-2 font-ui text-title text-ink">{name}</h3>
      {ingredients && (
        <p className="mt-1 line-clamp-2 font-body text-caption font-normal tracking-normal text-charcoal">
          {ingredients}
        </p>
      )}
      {grams && (
        <p className="mt-1 font-body text-meta text-smoke tabular-nums">
          {grams}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="price-pill tabular-nums">
          {from && (
            <span className="text-[12px] font-semibold">{t.menu.from}</span>
          )}
          {/* Пробел в тексте: без него скринридер читает «de la80 lei» */}
          {from && " "}
          <span>
            {price}
            {" "}
            {t.menu.currency}
          </span>
        </span>
        {/* Пока без действия: корзина — следующая задача */}
        <button
          type="button"
          aria-label={`${t.product.add}: ${name}`}
          className="add-button shrink-0"
        >
          <Plus size={18} strokeWidth={2.25} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
