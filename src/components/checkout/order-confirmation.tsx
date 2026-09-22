"use client";
// Подтверждение заказа (SPEC §3 шаг 6, DESIGN.md → Order Confirmation):
// круг 96px Yellow с галочкой Ink, номер Oswald 44px, «Te sunăm în câteva
// minute», точка и её телефон (tel:), состав через rule-dotted, итого,
// Secondary «Sună la local» и Primary «Înapoi la meniu».
// Данные — снимок ответа сервера из sessionStorage (базы ещё нет); нет
// снимка (другая вкладка, прямая ссылка) — в меню.
// Появление: CSS-анимация, 240ms, лесенка 60ms; reduced-motion → мгновенно.
import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { CitySlug, Locale } from "@/data/points";
import { fill, formatPrice, type Messages } from "@/i18n/messages";
import { localePath, paths } from "@/i18n/routes";
import { describeParts } from "@/lib/cart/describe";
import { formatPhoneDisplay, phoneHref } from "@/lib/order/phone";
import { parseReceipt, readReceiptRaw } from "@/lib/order/receipt";

const noop = () => () => {};

export function OrderConfirmation({
  city,
  number,
  locale,
  t,
}: {
  city: CitySlug;
  number: number;
  locale: Locale;
  t: Messages;
}) {
  const router = useRouter();
  const getRaw = useCallback(() => readReceiptRaw(number), [number]);
  const raw = useSyncExternalStore(noop, getRaw, () => null);
  const receipt = useMemo(
    () => parseReceipt(raw, number, city),
    [raw, number, city],
  );

  // Читаем хранилище напрямую: при гидратации raw ещё «серверный» (null)
  useEffect(() => {
    if (!parseReceipt(readReceiptRaw(number), number, city)) {
      router.replace(localePath(locale, paths.city(city)));
    }
  }, [number, city, locale, router]);

  if (!receipt) return <main className="page min-h-[60dvh]" />;

  return (
    <main className="page flex flex-col items-center pt-10 pb-16 text-center">
      <span className="confirm-check" aria-hidden="true">
        <Check size={44} strokeWidth={2.25} />
      </span>
      <h1
        style={{ "--step": 1 } as React.CSSProperties}
        className="confirm-step mt-6 font-display text-city uppercase tabular-nums"
      >
        {fill(t.confirmation.number, { n: String(receipt.number) })}
      </h1>
      <p
        style={{ "--step": 1 } as React.CSSProperties}
        className="confirm-step mt-3 font-body text-body text-charcoal"
      >
        {t.confirmation.callSoon}
      </p>
      <p
        style={{ "--step": 1 } as React.CSSProperties}
        translate="no"
        className="confirm-step mt-1 font-ui text-title"
      >
        {receipt.pointName}
      </p>

      <section
        style={{ "--step": 2 } as React.CSSProperties}
        className="confirm-step mt-8 w-full max-w-[520px] text-left"
      >
        <ul>
          {receipt.lines.map((line, i) => {
            const details = describeParts(line, locale, t);
            return (
              <li
                key={i}
                className="summary-line flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-ui text-label font-semibold">
                    <span className="tabular-nums">{line.qty} × </span>
                    {line.name[locale]}
                  </p>
                  {details && (
                    <p className="mt-0.5 font-body text-meta text-charcoal">
                      {details}
                    </p>
                  )}
                </div>
                <span className="flex-none font-ui text-label font-bold tabular-nums">
                  {formatPrice(locale, t, line.total)}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="summary-total flex items-baseline justify-between gap-3 pt-3">
          <span className="font-ui text-label font-semibold">
            {t.cart.total}
          </span>
          <span className="font-ui text-total tabular-nums">
            {formatPrice(locale, t, receipt.total)}
          </span>
        </div>
      </section>

      <div
        style={{ "--step": 3 } as React.CSSProperties}
        className="confirm-step mt-8 flex w-full max-w-[520px] flex-col gap-3"
      >
        <a href={phoneHref(receipt.pointPhone)} className="btn-secondary">
          {/* Одним элементом: во flex-кнопке пробел у края текста пропадает */}
          <span>
            {t.confirmation.call} ·{" "}
            <span className="tabular-nums">
              {formatPhoneDisplay(receipt.pointPhone)}
            </span>
          </span>
        </a>
        <Link
          href={localePath(locale, paths.city(city))}
          className="btn-primary"
        >
          {t.confirmation.back}
        </Link>
      </div>
    </main>
  );
}
