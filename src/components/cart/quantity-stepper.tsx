"use client";
// Счётчик «− N +» (лист блюда, строка корзины). Число — <output>: скринридер
// сам озвучивает новое значение.
import { Minus, Plus } from "lucide-react";
import type { Messages } from "@/i18n/messages";
import { MAX_QTY } from "@/lib/cart/lines";

export function QuantityStepper({
  value,
  onChange,
  t,
  label,
  size = "lg",
  min = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  t: Messages;
  /** Подпись группы для скринридера (по умолчанию «Cantitate») */
  label?: string;
  /** lg — 52px (рядом с Primary), sm — 40px (корзина) */
  size?: "lg" | "sm";
  min?: number;
}) {
  const button = size === "lg" ? "icon-button" : "icon-button size-10";
  const icon = size === "lg" ? 18 : 16;
  return (
    <div
      role="group"
      aria-label={label ?? t.a11y.quantity}
      className={`stepper ${size === "lg" ? "h-(--size-primary) px-1" : "h-10"}`}
    >
      <button
        type="button"
        className={button}
        aria-label={t.a11y.decrease}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={icon} strokeWidth={2} aria-hidden="true" />
      </button>
      <output>{value}</output>
      <button
        type="button"
        className={button}
        aria-label={t.a11y.increase}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={icon} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}
