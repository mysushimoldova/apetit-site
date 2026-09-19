// Описание позиции одной строкой: «XXL · Extra: Sos de usturoi · Sos aparte:
// Sosieră ketchup · Fără: roșii». Одно для корзины, оформления и
// подтверждения (там — из снимка заказа с сервера).
import type { Localized } from "@/data/menu/schema";
import type { Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";
import type { CartLine } from "./lines";
import type { Catalog } from "./pricing";

export interface LineParts {
  variant: Localized | null;
  extra: Localized[];
  cups: Localized[];
  without: Localized[];
}

export function lineParts(line: CartLine, catalog: Catalog): LineParts | null {
  const product = catalog.products[line.productSlug];
  if (!product) return null;
  const addons = line.addonIds
    .map((id) => catalog.addons[id])
    .filter((a) => a !== undefined);
  return {
    variant:
      product.variants?.find((v) => v.id === line.variantId)?.name ?? null,
    extra: addons.filter((a) => a.kind === "ingredient").map((a) => a.name),
    cups: addons.filter((a) => a.kind === "sauce-cup").map((a) => a.name),
    without: line.removedIds
      .map((id) => product.removable.find((r) => r.id === id)?.name)
      .filter((n) => n !== undefined),
  };
}

export function describeParts(
  parts: LineParts,
  locale: Locale,
  t: Messages,
): string {
  const out: string[] = [];
  const names = (list: Localized[]) => list.map((n) => n[locale]).join(", ");
  if (parts.variant) out.push(parts.variant[locale]);
  if (parts.extra.length) out.push(`${t.sheet.extra}: ${names(parts.extra)}`);
  if (parts.cups.length) out.push(`${t.sheet.sauceCup}: ${names(parts.cups)}`);
  if (parts.without.length) {
    out.push(`${t.sheet.without}: ${names(parts.without)}`);
  }
  return out.join(" · ");
}
