"use client";
// Свайп вниз закрывает лист (только телефон). Тянуть можно за любое место,
// если содержимое прокручено до верха и палец идёт вниз; решение принимается
// на первом движении, иначе жест остаётся прокрутке. Лист двигается через
// transform напрямую (без перерисовки React). Закрытие — если утянули больше
// четверти высоты или быстро смахнули; иначе лист возвращается на место.
// Альтернатива жесту для тех, кто не может тянуть, — крестик (WCAG 2.5.7).
import { useEffect, useRef, type RefObject } from "react";
import { isFlick, pushSample, type DragSample } from "./sheet-flick";

/** Доля высоты листа, после которой отпущенный лист закрывается. */
const CLOSE_DISTANCE = 0.25;
/** Возврат листа на место, мс (docs/MOTION.md §2 — мелкое изменение). */
const SNAP_BACK_MS = 200;
const DESKTOP = "(min-width: 1024px)";

export function useSheetDrag({
  panelRef,
  scrimRef,
  scrollRef,
  enabled,
  onDismiss,
}: {
  panelRef: RefObject<HTMLElement | null>;
  scrimRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const scrim = scrimRef.current;
    if (!panelRef.current || !enabled) return;
    // Отдельная константа: внутри обработчиков TypeScript уже знает, что не null
    const panel: HTMLElement = panelRef.current;

    let tracking = false;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    // Точки пальца за последние 100 мс — по ним считается скорость смаха
    let samples: DragSample[] = [];
    let offset = 0;

    const setInline = (
      transform: string,
      opacity: string,
      transition: string,
    ) => {
      panel.style.transition = transition;
      panel.style.transform = transform;
      if (scrim) {
        scrim.style.transition = transition;
        scrim.style.opacity = opacity;
      }
    };
    // Лист не утянули достаточно — возвращаем его на место. Это мелкое
    // движение, а не открытие: 200 мс по кривой входа (docs/MOTION.md §2–3,
    // решение архитектора 24.09.2026, было 500 мс от CSS-перехода).
    let snapTimer = 0;
    const snapBack = () => {
      setInline(
        "",
        "",
        `transform ${SNAP_BACK_MS}ms var(--ease-reveal), opacity ${SNAP_BACK_MS}ms var(--ease-reveal)`,
      );
      window.clearTimeout(snapTimer);
      // Вернуть переходы странице: дальше ими снова распоряжается CSS
      snapTimer = window.setTimeout(() => {
        panel.style.transition = "";
        if (scrim) scrim.style.transition = "";
      }, SNAP_BACK_MS);
    };

    function onStart(e: TouchEvent) {
      tracking = false;
      dragging = false;
      if (e.touches.length !== 1 || window.matchMedia(DESKTOP).matches) return;
      const scroller = scrollRef.current;
      if (scroller?.contains(e.target as Node) && scroller.scrollTop > 0)
        return;
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      samples = [{ t: e.timeStamp, y: startY }];
      offset = 0;
      tracking = true;
    }

    function onMove(e: TouchEvent) {
      if (!tracking) return;
      // Второй палец или браузер уже прокручивает — отпускаем жест
      if (e.touches.length !== 1 || !e.cancelable) {
        tracking = false;
        if (dragging) {
          dragging = false;
          snapBack();
        }
        return;
      }
      const touch = e.touches[0];
      const dy = touch.clientY - startY;
      if (!dragging) {
        const dx = touch.clientX - startX;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
          tracking = false;
          return;
        }
        dragging = true;
      }
      e.preventDefault();
      pushSample(samples, { t: e.timeStamp, y: touch.clientY });
      offset = Math.max(0, dy);
      const progress = Math.min(1, offset / panel.offsetHeight);
      setInline(`translate3d(0, ${offset}px, 0)`, String(1 - progress), "none");
    }

    function onEnd(e: TouchEvent) {
      if (!dragging) {
        tracking = false;
        return;
      }
      tracking = false;
      dragging = false;
      const flick = e.type === "touchend" && isFlick(samples, e.timeStamp);
      const far = offset > panel.offsetHeight * CLOSE_DISTANCE;
      if (e.type === "touchend" && (far || flick)) {
        // Лист закроется из текущего положения: Sheet уберёт inline-стили
        dismissRef.current();
      } else {
        snapBack();
      }
    }

    panel.addEventListener("touchstart", onStart, { passive: true });
    panel.addEventListener("touchmove", onMove, { passive: false });
    panel.addEventListener("touchend", onEnd, { passive: true });
    panel.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.clearTimeout(snapTimer);
      panel.removeEventListener("touchstart", onStart);
      panel.removeEventListener("touchmove", onMove);
      panel.removeEventListener("touchend", onEnd);
      panel.removeEventListener("touchcancel", onEnd);
    };
  }, [panelRef, scrimRef, scrollRef, enabled]);
}
