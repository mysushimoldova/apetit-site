"use client";
// Оформление заказа (SPEC §3 шаг 5). Телефон, сверху вниз (ответ
// архитектора): [Closed Banner] → заголовок → «Punctul» (если точек > 1) →
// Nume, Telefon, Adresă → ловушка для ботов → «Coș» (позиции и Total — для
// показа, сервер считает сам) → «Trimite comanda» + строка про звонок.
// Десктоп: поля и кнопка слева, «Coș» — колонкой справа.
// Корзина очищается только после ответа сервера «принято»; тогда же имя,
// телефон и адрес запоминаются на устройстве (SPEC §3 шаг 6).
// Пока заказ не отправлен, введённое лежит черновиком в sessionStorage —
// переключение RO/RU (полная загрузка страницы) его не стирает.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { submitOrderAction } from "@/server/order/actions";
import { ClosedBanner } from "@/components/order/closed-banner";
import type { Localized } from "@/data/menu/schema";
import type { CitySlug, Locale } from "@/data/points";
import { fillNodes } from "@/i18n/fill-nodes";
import { formatPrice, type Messages } from "@/i18n/messages";
import { localePath, paths } from "@/i18n/routes";
import { describeParts, lineParts } from "@/lib/cart/describe";
import { lineKey, type CartLine } from "@/lib/cart/lines";
import { priceLine, type Catalog } from "@/lib/cart/pricing";
import { cartStore, hydrateCart, useCart } from "@/lib/cart/store";
import { parseContact, readContactRaw, saveContact } from "@/lib/order/contact";
import {
  clearDraft,
  parseDraft,
  readDraftRaw,
  saveDraft,
} from "@/lib/order/draft";
import { maskPhoneInput } from "@/lib/order/phone";
import { saveReceipt } from "@/lib/order/receipt";
import {
  ADDRESS_MAX,
  NAME_MAX,
  fieldError,
  type OrderField,
} from "@/lib/order/fields";
import {
  SERVER_ERROR_TEXT,
  type ServerErrorText,
} from "@/lib/order/server-error";
import { useIsOpen } from "@/lib/order/use-is-open";
import { PointPicker, type PointView } from "./point-picker";
import { TextField } from "./text-field";

type FormField = OrderField | "point";

const FIELD_ORDER: readonly FormField[] = ["point", "name", "phone", "address"];
const NO_LINES: CartLine[] = [];
const noop = () => () => {};

export function CheckoutView({
  city,
  locale,
  t,
  points,
  catalogs,
  names,
}: {
  city: CitySlug;
  locale: Locale;
  t: Messages;
  points: PointView[];
  catalogs: Record<string, Catalog>;
  /** Названия всех блюд — и тех, которых нет в выбранной точке */
  names: Record<string, Localized>;
}) {
  const router = useRouter();
  const ids = useId();
  const fieldId = (f: FormField) => `${ids}-${f}`;

  // Корзина из localStorage — после монтирования (как на странице меню)
  useEffect(() => {
    if (!cartStore.getState().hydrated) hydrateCart(cartStore);
  }, []);
  const hydrated = useCart((s) => s.hydrated);
  const lines = useCart((s) =>
    s.hydrated && s.city === city ? s.lines : NO_LINES,
  );

  // Заказ принят — корзина уже пуста, но в меню уводить не надо
  const submitted = useRef(false);
  useEffect(() => {
    if (hydrated && lines.length === 0 && !submitted.current) {
      router.replace(localePath(locale, paths.city(city)));
    }
  }, [hydrated, lines.length, city, locale, router]);

  const single = points.length === 1;
  const [pointId, setPointId] = useState<string | null>(
    single ? points[0].id : null,
  );
  const point = points.find((p) => p.id === pointId) ?? points[0];
  const catalog = catalogs[point.id];

  const [values, setValues] = useState({ name: "", phone: "", address: "" });
  const [errors, setErrors] = useState<Partial<Record<FormField, boolean>>>({});
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<ServerErrorText | null>(null);
  const [unavailable, setUnavailable] = useState<number[]>([]);
  const [serverClosed, setServerClosed] = useState(false);
  const honeypot = useRef<HTMLInputElement>(null);
  // Язык, на котором оформляли (RO/RU) — уходит с заказом для Telegram и писем
  const langField = useRef<HTMLInputElement>(null);

  // Черновик этой вкладки (после смены языка) важнее контактов с прошлого
  // заказа; те подставляются, только если поле ещё пустое. На сервере
  // хранилищ нет (null), в браузере — подставляем один раз; то, что
  // человек уже начал вводить, не затираем
  const draftRaw = useSyncExternalStore(noop, readDraftRaw, () => null);
  const savedRaw = useSyncExternalStore(noop, readContactRaw, () => null);
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && (draftRaw !== null || savedRaw !== null)) {
    setPrefilled(true);
    const draft = parseDraft(draftRaw);
    const saved = parseContact(savedRaw);
    if (draft?.pointId && points.some((p) => p.id === draft.pointId)) {
      setPointId(draft.pointId);
    }
    if (draft || saved) {
      const pick = (field: keyof typeof values) =>
        draft?.[field] || saved?.[field] || "";
      setValues((v) => ({
        name: v.name || pick("name"),
        phone: v.phone || pick("phone"),
        address: v.address || pick("address"),
      }));
    }
  }

  const open = useIsOpen(point.hours);
  const closed = open === false || serverClosed;

  function check(field: OrderField, value: string): boolean {
    return fieldError(field, value) === null;
  }

  function setValue(field: OrderField, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    // Черновик — при каждом вводе, пока заказ не отправлен
    saveDraft({ ...next, pointId });
    // Ошибка уже показана — убираем, как только поле исправили
    if (errors[field] && check(field, value)) {
      setErrors((e) => ({ ...e, [field]: false }));
    }
  }

  // Проверка при уходе с поля — только если что-то введено
  function onBlur(field: OrderField) {
    const value = values[field];
    if (value.trim() !== "") {
      setErrors((e) => ({ ...e, [field]: !check(field, value) }));
    }
  }

  function focusField(field: FormField) {
    const el =
      field === "point"
        ? document.querySelector<HTMLInputElement>(
            `input[name="${fieldId("point")}"]`,
          )
        : document.getElementById(fieldId(field));
    el?.focus();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || closed) return;

    const next: Partial<Record<FormField, boolean>> = {
      point: pointId === null,
      name: !check("name", values.name),
      phone: !check("phone", values.phone),
      address: !check("address", values.address),
    };
    setErrors(next);
    const firstInvalid = FIELD_ORDER.find((f) => next[f]);
    if (firstInvalid) {
      focusField(firstInvalid);
      return;
    }

    setSending(true);
    setServerError(null);
    setUnavailable([]);
    try {
      const result = await submitOrderAction({
        pointId,
        lines,
        name: values.name,
        phone: values.phone,
        address: values.address,
        website: honeypot.current?.value ?? "",
        lang: langField.current?.value ?? locale,
      });
      if (result.ok) {
        saveReceipt(result.receipt);
        saveContact(values);
        clearDraft();
        submitted.current = true;
        cartStore.getState().clear();
        router.replace(
          localePath(locale, paths.confirmation(city, result.receipt.number)),
        );
        return; // кнопка остаётся неактивной до перехода
      }
      switch (result.code) {
        case "invalid": {
          const fields = Object.fromEntries(
            result.fields.map((f) => [f, true]),
          );
          setErrors(fields);
          focusField(result.fields[0]);
          break;
        }
        case "closed":
          setServerClosed(true);
          break;
        case "unavailable":
          setUnavailable(result.lines);
          setServerError("unavailable");
          break;
        // Точка на паузе, лимит по номеру, база не ответила, мусор — на
        // каждый свой текст (список — src/lib/order/server-error.ts)
        default:
          setServerError(SERVER_ERROR_TEXT[result.code]);
      }
    } catch {
      // Сеть пропала или сервер упал: форма и корзина на месте — нажать ещё раз
      setServerError("network");
    }
    setSending(false);
  }

  const priced = lines.map((line, i) => ({
    line,
    price: unavailable.includes(i) ? null : priceLine(line, catalog),
    parts: lineParts(line, catalog),
  }));
  const total = priced.reduce((sum, p) => sum + (p.price?.total ?? 0), 0);
  const err = (f: FormField) => (errors[f] ? t.checkout.errors[f] : null);
  const serverMessage = serverError ? t.checkout.errors[serverError] : null;

  return (
    <main className="page pt-4 pb-16 lg:pt-8">
      <Link href={localePath(locale, paths.city(city))} className="back-link">
        <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        {t.checkout.back}
      </Link>

      {closed && (
        <div className="mt-4">
          <ClosedBanner hours={point.hours} t={t} />
        </div>
      )}

      <h1 className="mt-4 font-display text-city uppercase">
        {t.checkout.title}
      </h1>

      <form
        noValidate
        onSubmit={onSubmit}
        className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-16 lg:gap-y-6"
      >
        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
          {!single && (
            <PointPicker
              points={points}
              value={pointId}
              onChange={(id) => {
                setPointId(id);
                saveDraft({ ...values, pointId: id });
                setErrors((e) => ({ ...e, point: false }));
                setUnavailable([]);
                setServerError(null);
              }}
              error={err("point")}
              locale={locale}
              t={t}
              groupId={fieldId("point")}
            />
          )}

          <TextField
            id={fieldId("name")}
            label={t.checkout.name}
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            spellCheck={false}
            maxLength={NAME_MAX}
            required
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
            onBlur={() => onBlur("name")}
            error={err("name")}
          />
          <TextField
            id={fieldId("phone")}
            label={t.checkout.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t.checkout.phonePlaceholder}
            required
            value={values.phone}
            onChange={(e) => setValue("phone", maskPhoneInput(e.target.value))}
            onBlur={() => onBlur("phone")}
            error={err("phone")}
          />
          <TextField
            id={fieldId("address")}
            label={t.checkout.address}
            hint={t.checkout.addressHint}
            name="address"
            autoComplete="street-address"
            maxLength={ADDRESS_MAX}
            value={values.address}
            onChange={(e) => setValue("address", e.target.value)}
            onBlur={() => onBlur("address")}
            error={err("address")}
          />

          {/* Ловушка для ботов (SPEC §9.4): человек её не видит, скринридер
                не читает, Tab не заходит, браузер не заполняет */}
          <div className="hidden" aria-hidden="true">
            <input
              ref={honeypot}
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>
          <input ref={langField} type="hidden" name="lang" value={locale} />
        </div>

        <section
          aria-labelledby={`${ids}-summary`}
          className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          <h2 id={`${ids}-summary`} className="caption-caps">
            {t.cart.title}
          </h2>
          <ul className="mt-2">
            {priced.map(({ line, price, parts }) => {
              const name =
                names[line.productSlug]?.[locale] ?? line.productSlug;
              const details = parts ? describeParts(parts, locale, t) : "";
              return (
                <li
                  key={lineKey(line)}
                  className="summary-line flex items-start justify-between gap-3 py-3"
                  data-unavailable={price === null || undefined}
                >
                  <div className="min-w-0">
                    <p className="font-ui text-label font-semibold">
                      <span className="tabular-nums">{line.qty} × </span>
                      {name}
                    </p>
                    {details && (
                      <p className="mt-0.5 font-body text-meta text-charcoal">
                        {details}
                      </p>
                    )}
                    {price === null && (
                      <p className="field-error">
                        {t.checkout.errors.unavailableLine}
                      </p>
                    )}
                  </div>
                  {price && (
                    <span className="flex-none font-ui text-label font-bold tabular-nums">
                      {formatPrice(locale, t, price.total)}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="summary-total flex items-baseline justify-between gap-3 pt-3">
            <span className="font-ui text-label font-semibold">
              {t.cart.total}
            </span>
            <span className="font-ui text-total tabular-nums">
              {formatPrice(locale, t, total)}
            </span>
          </div>
        </section>

        <div className="lg:col-start-1 lg:row-start-2">
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={closed || sending || !hydrated}
            aria-busy={sending || undefined}
          >
            {sending ? t.checkout.sending : t.checkout.submit}
          </button>
          {serverMessage && (
            <p role="alert" className="field-error mt-3 text-center">
              {serverMessage}
            </p>
          )}
          <p className="mt-3 text-center font-body text-meta text-charcoal">
            {t.checkout.callNote}
          </p>
          {/* Согласие с условиями — без галочки. Ссылки открываются в новой
              вкладке, чтобы не потерять заполненную форму. */}
          <p className="consent-note mt-2 text-center font-body text-meta text-smoke">
            {fillNodes(t.checkout.consent.text, {
              terms: (
                <Link
                  href={localePath(locale, paths.terms())}
                  target="_blank"
                  rel="noopener"
                >
                  {t.checkout.consent.terms}
                </Link>
              ),
              privacy: (
                <Link
                  href={localePath(locale, paths.privacy())}
                  target="_blank"
                  rel="noopener"
                >
                  {t.checkout.consent.privacy}
                </Link>
              ),
            })}
          </p>
        </div>
      </form>
    </main>
  );
}
