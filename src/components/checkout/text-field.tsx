"use client";
// Input (DESIGN.md): подпись caption-caps над полем, Milk, рамка hairline,
// 12px, 52px, Montserrat 15px. Фокус — рамка rule. Ошибка — рамка Closed и
// подпись 12px под полем (связана через aria-describedby, объявляется).
import { forwardRef, type InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  /** Подпись рядом с label («dacă vrei livrare») */
  hint?: string;
  error?: string | null;
};

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { id, label, hint, error, ...input },
  ref,
) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="caption-caps">
          {label}
        </label>
        {hint && (
          <span id={hintId} className="font-body text-meta text-smoke">
            {hint}
          </span>
        )}
      </div>
      <input
        ref={ref}
        id={id}
        className="input mt-2"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {error && (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
});
