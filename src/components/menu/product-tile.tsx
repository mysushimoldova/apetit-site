// Плитка блюда (DESIGN.md → Product Tile): без поверхности, рамки и тени.
// Фото → название (2 строки) → состав (2 строки, «…») → граммы → ценник и «+».
// Нажатие на фото/название открывает лист блюда; «+» — корзина.
// Сама плитка серверная, интерактивны два островка: название и «+».
import type { Locale } from "@/data/points";
import { priceLabel, type MenuProduct } from "@/data/menu";
import type { Messages } from "@/i18n/messages";
import { FoodImage } from "./food-image";
import { TileCartControl } from "./tile-cart-control";
import { TileOpenButton } from "./tile-open-button";

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
    <article data-reveal className="relative flex min-w-0 flex-col">
      <FoodImage photo={product.photo} alt={name} eager={eager} />
      <h3 className="mt-4 font-ui text-title text-ink">
        <TileOpenButton slug={product.slug} name={name} />
      </h3>
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
      {/* flex-wrap: на узких экранах (360px) счётчик уходит на строку ниже */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
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
        <TileCartControl
          slug={product.slug}
          name={name}
          hasVariants={product.variants !== null}
        />
      </div>
    </article>
  );
}
