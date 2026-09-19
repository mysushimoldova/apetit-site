"use client";
// «Golește coșul» (ответ архитектора): подтверждение вторым нажатием на ту же
// кнопку, без окна. Первое нажатие — кнопка становится Ink «Da, golește»;
// через 4 с или если фокус ушёл — возвращается как была.
import { useEffect, useState } from "react";
import { cartStore } from "@/lib/cart/store";
import { useCartContext } from "./cart-context";

const DISARM_MS = 4000;

export function ClearCartButton() {
  const { t } = useCartContext();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), DISARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      data-armed={armed || undefined}
      className="btn-secondary w-full"
      onClick={() => {
        if (armed) cartStore.getState().clear();
        else setArmed(true);
      }}
      onBlur={() => setArmed(false)}
    >
      {armed ? t.cart.clearConfirm : t.cart.clear}
    </button>
  );
}
