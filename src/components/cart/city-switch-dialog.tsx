"use client";
// Корзина принадлежит другому городу (SPEC §3 шаг 4: «сменил город — корзина
// очищается с предупреждением»). Показывается при входе на страницу другого
// города — так ловятся все пути: кнопка в шапке, ссылка из Google, закладка.
// «Continuă» — очистить; «Anulează» и Esc — вернуться в старый город.
// Тап по фону не закрывает: нужно явное решение.
import { useId, useRef } from "react";
import { Sheet } from "@/components/sheet/sheet";
import { useCartContext } from "./cart-context";

export function CitySwitchDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useCartContext();
  const titleId = useId();
  // Фокус — на наименее разрушительное действие
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Sheet
      open={open}
      onDismiss={onCancel}
      labelledBy={titleId}
      closeLabel={t.a11y.close}
      role="alertdialog"
      dismissible={false}
      initialFocus={cancelRef}
    >
      <p id={titleId} className="font-ui text-title text-balance">
        {t.citySwitch.title}
      </p>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row-reverse">
        <button
          type="button"
          className="btn-primary lg:flex-1"
          onClick={onConfirm}
        >
          {t.citySwitch.confirm}
        </button>
        <button
          ref={cancelRef}
          type="button"
          className="btn-secondary lg:flex-1"
          onClick={onCancel}
        >
          {t.citySwitch.cancel}
        </button>
      </div>
    </Sheet>
  );
}
