// Closed Banner (DESIGN.md): без заливки, рамка rule, 12px, Montserrat 15px
// Ink, точка Closed. Текст — «Primim comenzi 08:30–23:00» (часы точки).
import { fill, type Messages } from "@/i18n/messages";
import type { Hours } from "@/lib/order/hours";

export function ClosedBanner({ hours, t }: { hours: Hours; t: Messages }) {
  return (
    <p role="status" className="closed-banner">
      <span className="closed-dot" aria-hidden="true" />
      {fill(t.closed.banner, { open: hours.open, close: hours.close })}
    </p>
  );
}
