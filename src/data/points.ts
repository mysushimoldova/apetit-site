// Точки Apetit — SPEC.md §1.1 (РЕШЕНО). Пока статический список; на этапе
// админки переедет в Supabase, а эти типы и функции останутся.

// Florești закрылась (19.09.2026) — точки и города на сайте больше нет.
export type CitySlug = "soroca" | "sculeni" | "otaci" | "briceni";

/** Язык интерфейса по умолчанию для города (SPEC §3 шаг 1: Otaci → ru). */
export type Locale = "ro" | "ru";

export interface City {
  slug: CitySlug;
  /** Название как в меню — латиницей, на обоих языках одинаково. */
  name: string;
  locale: Locale;
}

export interface Point {
  id: string;
  citySlug: CitySlug;
  name: string;
  /** Формат Молдовы без кода страны: 0XXXXXXXX. */
  phone: string;
  ownership: "own" | "franchise";
  locale: Locale;
  hours: { open: string; close: string };
  address: string;
  /** Переключатель «временно не принимает заказы» (SPEC §1.1, на случай ЧП). */
  acceptingOrders: boolean;
  /** Координаты — для «~1,2 km» при оформлении; null — расстояние не показываем. */
  coords: { lat: number; lng: number } | null;
}

const HOURS = { open: "08:30", close: "23:00" } as const;

/** Четыре города в порядке SPEC §1.1 — в этом порядке рисуются плитки. */
export const CITIES: readonly City[] = [
  { slug: "soroca", name: "Soroca", locale: "ro" },
  { slug: "sculeni", name: "Sculeni", locale: "ro" },
  { slug: "otaci", name: "Otaci", locale: "ru" },
  { slug: "briceni", name: "Briceni", locale: "ro" },
];

// Адреса и координаты — от Амяна (SPEC §1.1). Sculeni в Google называется
// COFFEEIN (кофейня + Apetit, одна касса), на сайте — «Apetit Sculeni».
export const POINTS: readonly Point[] = [
  {
    id: "soroca-centru",
    citySlug: "soroca",
    name: "Apetit Centru",
    phone: "067578757",
    ownership: "own",
    locale: "ro",
    hours: HOURS,
    address: "Str. Independenței 72",
    acceptingOrders: true,
    coords: { lat: 48.156795, lng: 28.3036351 },
  },
  {
    id: "soroca-noua",
    citySlug: "soroca",
    name: "Apetit Soroca Nouă",
    phone: "068372707",
    ownership: "own",
    locale: "ro",
    hours: HOURS,
    address: "Dimitrie Cantemir 24F",
    acceptingOrders: true,
    coords: { lat: 48.1750314, lng: 28.3205164 },
  },
  {
    id: "sculeni",
    citySlug: "sculeni",
    name: "Apetit Sculeni",
    phone: "060696527",
    ownership: "franchise",
    locale: "ro",
    hours: HOURS,
    address: "Calea Ieșilor E58",
    acceptingOrders: true,
    coords: { lat: 47.3272293, lng: 27.6120934 },
  },
  {
    id: "otaci",
    citySlug: "otaci",
    name: "Apetit Otaci",
    phone: "069247474",
    ownership: "franchise",
    locale: "ru",
    hours: HOURS,
    address: "Prieteniei 66",
    acceptingOrders: true,
    coords: { lat: 48.4422993, lng: 27.7876133 },
  },
  {
    id: "briceni",
    citySlug: "briceni",
    name: "Apetit Briceni",
    phone: "076777123",
    ownership: "franchise",
    locale: "ro",
    hours: HOURS,
    address: "Strada Mihai Eminescu 54",
    acceptingOrders: true,
    coords: { lat: 48.3529048, lng: 27.0849932 },
  },
];

const CITY_SLUGS: ReadonlySet<string> = new Set(CITIES.map((c) => c.slug));

export function isCitySlug(value: string): value is CitySlug {
  return CITY_SLUGS.has(value);
}

export function getCity(slug: CitySlug): City {
  const city = CITIES.find((c) => c.slug === slug);
  if (!city) throw new Error(`Unknown city slug: ${slug}`);
  return city;
}

export function getPoint(id: string): Point | undefined {
  return POINTS.find((p) => p.id === id);
}

export function pointsOfCity(slug: CitySlug): Point[] {
  return POINTS.filter((p) => p.citySlug === slug);
}
