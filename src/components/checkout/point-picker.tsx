"use client";
// Блок «Punctul» (SPEC §3 шаг 5, DESIGN.md → Point Card) — только если в
// городе больше одной точки. Карточка: Milk, рамка rule, 16px, название,
// адрес, часы, справа расстояние «~1,2 km». Выбранная — рамка 2px Yellow
// (и галочка Ink: жёлтая рамка на кремовом фоне видна слабо).
// Геолокация — только здесь, при показе блока, и только если у точек есть
// координаты. Отказ — просто без расстояния.
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import type { Locale } from "@/data/points";
import type { Messages } from "@/i18n/messages";
import { distanceKm, formatKm, type LatLng } from "@/lib/order/geo";
import type { Hours } from "@/lib/order/hours";

export interface PointView {
  id: string;
  name: string;
  address: string;
  phone: string;
  hours: Hours;
  coords: LatLng | null;
}

export function PointPicker({
  points,
  value,
  onChange,
  error,
  locale,
  t,
  groupId,
}: {
  points: PointView[];
  value: string | null;
  onChange: (id: string) => void;
  error: string | null;
  locale: Locale;
  t: Messages;
  groupId: string;
}) {
  const [here, setHere] = useState<LatLng | null>(null);
  const hasCoords = points.some((p) => p.coords !== null);

  useEffect(() => {
    if (!hasCoords || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Отказ или ошибка — без расстояния и без уговоров
      },
      { maximumAge: 5 * 60_000, timeout: 10_000 },
    );
  }, [hasCoords]);

  const errorId = `${groupId}-error`;
  return (
    <fieldset
      className="min-w-0"
      aria-describedby={error ? errorId : undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="caption-caps">{t.checkout.point}</legend>
      <div className="mt-2 grid gap-3 lg:grid-cols-2">
        {points.map((p) => {
          const distance =
            here && p.coords
              ? formatKm(locale, distanceKm(here, p.coords), t.checkout.km)
              : null;
          return (
            <label key={p.id} className="point-card">
              <input
                type="radio"
                name={groupId}
                value={p.id}
                checked={value === p.id}
                onChange={() => onChange(p.id)}
                className="sr-only"
              />
              <span className="flex items-start justify-between gap-3">
                <span translate="no" className="font-ui text-title">
                  {p.name}
                </span>
                {distance && (
                  <span className="flex-none font-ui text-label font-semibold tabular-nums">
                    {distance}
                  </span>
                )}
              </span>
              <span className="mt-1 block font-body text-meta text-charcoal">
                {p.address}
              </span>
              <span className="mt-1 flex items-center justify-between gap-3">
                <span className="font-body text-meta text-smoke tabular-nums">
                  {p.hours.open}–{p.hours.close}
                </span>
                <span className="point-check" aria-hidden="true">
                  <Check size={14} strokeWidth={2.5} />
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
