"use client";
// Корзина на странице города. Оборачивает шапку, чипы и меню (они остаются
// серверными) и добавляет поверх: лист блюда, Cart Bar, лист корзины,
// подтверждение смены города и одно сообщение для скринридера.
// Каталог города приходит с сервера один раз (src/lib/cart/catalog.ts).
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CitySlug, Locale } from "@/data/points";
import { formatPrice, plural, type Messages } from "@/i18n/messages";
import type { Catalog } from "@/lib/cart/pricing";
import {
  CART_STORAGE_KEY,
  cartStore,
  hydrateCart,
  useCart,
} from "@/lib/cart/store";
import { CartBar } from "./cart-bar";
import {
  CartContext,
  useCitySummary,
  type CartContextValue,
} from "./cart-context";
import { CartSheet } from "./cart-sheet";
import { CitySwitchDialog } from "./city-switch-dialog";
import { ProductSheet } from "./product-sheet";

export function CartProvider({
  city,
  locale,
  t,
  catalog,
  children,
}: {
  city: CitySlug;
  locale: Locale;
  t: Messages;
  catalog: Catalog;
  children: ReactNode;
}) {
  const [sheet, setSheet] = useState<{ slug: string; open: boolean } | null>(
    null,
  );
  const [cartOpen, setCartOpen] = useState(false);

  const openProduct = useCallback(
    (slug: string) => setSheet({ slug, open: true }),
    [],
  );
  const openCart = useCallback(() => setCartOpen(true), []);
  const value = useMemo<CartContextValue>(
    () => ({ city, locale, t, catalog, openProduct, openCart }),
    [city, locale, t, catalog, openProduct, openCart],
  );

  // Сохранённая корзина — после монтирования (HTML сервера = пустая корзина);
  // изменили в другой вкладке — перечитываем
  useEffect(() => {
    if (!cartStore.getState().hydrated) hydrateCart(cartStore);
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY) hydrateCart(cartStore);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const hydrated = useCart((s) => s.hydrated);
  const cartCity = useCart((s) => s.city);
  const hasLines = useCart((s) => s.lines.length > 0);
  const otherCity =
    hydrated && hasLines && cartCity !== null && cartCity !== city;

  // Блюдо выключили в точке или сменились данные — такие позиции убираем
  useEffect(() => {
    if (hydrated && cartCity === city) cartStore.getState().prune(catalog);
  }, [hydrated, cartCity, city, catalog]);

  const router = useRouter();
  const leaveToCartCity = useCallback(() => {
    if (cartCity) router.push(`/${cartCity}`);
  }, [cartCity, router]);

  const { positions, total } = useCitySummary(city, catalog);
  // Корзину опустошили, пока лист открыт, — закрываем его
  if (cartOpen && positions === 0) setCartOpen(false);

  // Одно атомарное сообщение для скринридера после каждого изменения корзины
  // (не при загрузке страницы)
  const [announce, setAnnounce] = useState(false);
  useEffect(
    () =>
      cartStore.subscribe((s, prev) => {
        if (prev.hydrated && s.lines !== prev.lines) setAnnounce(true);
      }),
    [],
  );
  const status =
    announce && positions > 0
      ? `${plural(locale, t.cart.positions, positions)} · ${formatPrice(locale, t, total)}`
      : "";

  const product = sheet ? catalog.products[sheet.slug] : undefined;

  return (
    <CartContext value={value}>
      {children}
      {/* Контент не прячется под баром (DESIGN.md → Layout: +88px снизу) */}
      {positions > 0 && <div className="h-22 lg:hidden" aria-hidden="true" />}
      <CartBar />
      {sheet && product && (
        <ProductSheet
          key={sheet.slug}
          product={product}
          open={sheet.open}
          onDismiss={() => setSheet((s) => s && { ...s, open: false })}
          onClosed={() => setSheet((s) => (s && !s.open ? null : s))}
        />
      )}
      <CartSheet open={cartOpen} onDismiss={() => setCartOpen(false)} />
      <CitySwitchDialog
        open={otherCity}
        onConfirm={() => cartStore.getState().switchCity(city)}
        onCancel={leaveToCartCity}
      />
      <p role="status" aria-atomic="true" className="sr-only">
        {status}
      </p>
    </CartContext>
  );
}
