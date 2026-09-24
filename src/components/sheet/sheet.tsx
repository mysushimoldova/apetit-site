"use client";
// Лист (DESIGN.md → Product Sheet): bottom sheet на телефоне, модалка 520px
// на десктопе. Нативный <dialog> + showModal(): браузер сам делает остальную
// страницу недоступной (фокус не уходит под лист), даёт Esc и верхний слой.
// Закрытие: крестик, тап по фону, Esc, свайп вниз. Анимация — CSS-переходы
// по data-state (globals.css → .sheet); при закрытии диалог остаётся открытым,
// пока лист уезжает (--dur-in), потом close() и фокус возвращается туда,
// откуда лист открыли.
import { X } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useSheetDrag } from "./use-sheet-drag";

/** = --dur-in: столько длится закрытие шторки (docs/MOTION.md §2) */
const EXIT_MS = 320;
/** То же при «уменьшить движение»: лист не уезжает, а гаснет за 180 мс
 *  (docs/MOTION.md §6, решение архитектора 24.09.2026 — было мгновенно) */
const EXIT_REDUCED_MS = 180;

// Открытые сейчас листы, снизу вверх: «закрыть» для каждого. Нужен, чтобы
// кнопка «назад» снимала только верхний и чтобы мы знали, чья запись в
// истории наверху.
const OPEN_SHEETS: (() => void)[] = [];
/** Отложенный шаг назад: снимаем свою запись из истории не сразу. */
let pendingBack: number | null = null;
/** Шаг назад сделали мы сами — такой popstate не про кнопку «назад». */
let selfPop = false;

// Блокировка прокрутки страницы, пока открыт хотя бы один лист
let locks = 0;
function lockScroll() {
  if (locks++ > 0) return;
  const html = document.documentElement;
  // Полоса прокрутки на десктопе исчезнет — чтобы страница не прыгнула вбок
  const gap = window.innerWidth - html.clientWidth;
  if (gap > 0) html.style.paddingRight = `${gap}px`;
  html.setAttribute("data-scroll-lock", "");
}
function unlockScroll() {
  if (--locks > 0) return;
  const html = document.documentElement;
  html.removeAttribute("data-scroll-lock");
  html.style.paddingRight = "";
}

export interface SheetProps {
  open: boolean;
  /** Человек хочет закрыть: крестик, фон, Esc, свайп. */
  onDismiss: () => void;
  /** Лист уехал и убран со страницы. */
  onClosed?: () => void;
  labelledBy: string;
  closeLabel: string;
  role?: "dialog" | "alertdialog";
  /** false — закрыть можно только кнопками внутри (и Esc = onDismiss). */
  dismissible?: boolean;
  /** Куда поставить фокус при открытии (по умолчанию — крестик). */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Низ листа — всегда виден, не прокручивается. */
  footer?: ReactNode;
  children: ReactNode;
}

export function Sheet(props: SheetProps) {
  const [mounted, setMounted] = useState(props.open);
  // Открыли — монтируем сразу; закрыли — ждём конца анимации (onExited)
  if (props.open && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <SheetDialog
      {...props}
      onExited={() => {
        setMounted(false);
        props.onClosed?.();
      }}
    />
  );
}

function SheetDialog({
  open,
  onDismiss,
  onExited,
  labelledBy,
  closeLabel,
  role = "dialog",
  dismissible = true,
  initialFocus,
  footer,
  children,
}: SheetProps & { onExited: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Свежие колбэки без перезапуска эффектов
  const callbacks = useRef({ onDismiss, onExited, open });
  useEffect(() => {
    callbacks.current = { onDismiss, onExited, open };
  });

  // Показ поверх страницы; при размонтировании — close(), блок прокрутки снят,
  // фокус возвращается на кнопку, которая открыла лист
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    dialog.showModal();
    lockScroll();
    initialFocus?.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
      unlockScroll();
      const active = document.activeElement;
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        (!active || active === document.body)
      ) {
        opener.focus({ preventScroll: true });
      }
    };
    // Только при монтировании: initialFocus — ref, он не меняется
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Кнопка «назад» (на Android — системная) закрывает лист, а не уводит со
  // страницы. На открытие кладём в историю пустую запись, «назад» её
  // снимает — и мы закрываем лист; если лист закрыли иначе, запись убираем
  // сами. Учёт ведём своим списком, а не в history.state: маршрутизатор
  // Next 16 переписывает состояние записи под себя, и полагаться на него
  // нельзя (проверено — страница уезжала на две записи назад).
  useEffect(() => {
    const path = location.pathname + location.search;
    const dismiss = () => callbacks.current.onDismiss();
    OPEN_SHEETS.push(dismiss);

    if (pendingBack !== null) {
      // Предыдущий лист только что закрылся, но свою запись снять не успел —
      // забираем её себе. Так в режиме разработки React монтирует эффект
      // дважды (эффект → уборка → эффект): без этого в историю уходили две
      // записи и «назад» уводил со страницы.
      window.clearTimeout(pendingBack);
      pendingBack = null;
    } else {
      window.history.pushState(window.history.state, "");
    }

    const onPop = () => {
      // Назад шагнули мы сами (закрывали лист) — это не кнопка «назад»
      if (selfPop) {
        selfPop = false;
        return;
      }
      // Закрываем только верхний лист: если один открыт поверх другого,
      // «назад» снимает их по одному
      if (OPEN_SHEETS[OPEN_SHEETS.length - 1] !== dismiss) return;
      OPEN_SHEETS.pop();
      dismiss();
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      const index = OPEN_SHEETS.indexOf(dismiss);
      if (index < 0) return; // запись уже сняла кнопка «назад»
      OPEN_SHEETS.splice(index, 1);
      // Ушли на другую страницу (из корзины по ссылке «Comandă») — наша
      // запись уже не наверху. Шагнуть назад значит отменить переход.
      if (location.pathname + location.search !== path) return;
      pendingBack = window.setTimeout(() => {
        pendingBack = null;
        selfPop = true;
        window.history.back();
      }, 0);
    };
  }, []);

  // Открытие/закрытие: data-state на <dialog> → CSS-переходы
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!dialog || !panel || !scrim) return;
    if (open) {
      // Прочитать положение, чтобы браузер зафиксировал «закрытое» состояние
      // и следующий кадр стал переходом, а не прыжком
      void panel.getBoundingClientRect();
      dialog.dataset.state = "open";
      return;
    }
    // Если лист тянули пальцем — уезжает из текущего положения
    for (const el of [panel, scrim]) {
      el.style.transition = "";
      el.style.transform = "";
      el.style.opacity = "";
    }
    dialog.dataset.state = "closed";
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => callbacks.current.onExited(),
      reduce ? EXIT_REDUCED_MS : EXIT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  useSheetDrag({
    panelRef,
    scrimRef,
    scrollRef: bodyRef,
    enabled: dismissible && open,
    onDismiss,
  });

  return (
    <dialog
      ref={dialogRef}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={labelledBy}
      className="sheet"
      // Esc: браузер хочет закрыть сам — закрываем по-своему, с анимацией
      onCancel={(e) => {
        e.preventDefault();
        callbacks.current.onDismiss();
      }}
      // Браузер закрыл диалог без нас (повторный Esc) — синхронизируемся.
      // Событие приходит асинхронно: если диалог уже снова открыт (React в
      // режиме разработки монтирует дважды: close() → showModal()), это эхо.
      onClose={() => {
        if (callbacks.current.open && !dialogRef.current?.open) {
          callbacks.current.onDismiss();
        }
      }}
    >
      <div
        ref={scrimRef}
        className="sheet-scrim"
        aria-hidden="true"
        onClick={dismissible ? () => callbacks.current.onDismiss() : undefined}
      />
      <div ref={panelRef} className="sheet-panel">
        {dismissible ? (
          <div className="sheet-top">
            <span className="sheet-handle" aria-hidden="true" />
            <button
              type="button"
              className="icon-button absolute top-0 right-1 lg:top-2 lg:right-2"
              aria-label={closeLabel}
              onClick={() => callbacks.current.onDismiss()}
            >
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="h-6 flex-none" aria-hidden="true" />
        )}
        <div ref={bodyRef} className="sheet-body">
          {children}
        </div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </dialog>
  );
}
