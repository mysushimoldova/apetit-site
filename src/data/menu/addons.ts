// Платные добавки — SPEC 2.4 (касса МойСклад, категория «1. Adaos Apetit»).
// Одинаковые на всех точках. ingredient — в блюдо; sauce-cup — соусник отдельно.
// TODO ru: проверить — русские названия черновые.
import type { Addon } from "./schema";

export const ADDONS: readonly Addon[] = [
  {
    id: "carne",
    name: { ro: "Carne (50 g)", ru: "Мясо (50 г)" },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "sunca",
    name: { ro: "Șuncă (50 g)", ru: "Ветчина (50 г)" },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "salam",
    name: { ro: "Salam (50 g)", ru: "Салями (50 г)" },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "becon",
    name: { ro: "Becon (40 g)", ru: "Бекон (40 г)" },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "ceapa-caramelizata",
    name: { ro: "Ceapă caramelizată", ru: "Карамелизированный лук" },
    price: 8,
    kind: "ingredient",
  },
  {
    id: "cascaval-felii",
    name: { ro: "Cașcaval felii", ru: "Сыр ломтиками" },
    price: 6,
    kind: "ingredient",
  },
  {
    id: "morcov",
    name: { ro: "Morcov", ru: "Морковь" },
    price: 6,
    kind: "ingredient",
  },
  {
    id: "castraveti-felii",
    name: { ro: "Castraveți felii", ru: "Огурцы ломтиками" },
    price: 2,
    kind: "ingredient",
  },
  {
    id: "sos-usturoi",
    name: {
      ro: "Sos de usturoi (în preparat)",
      ru: "Чесночный соус (в блюдо)",
    },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "sos-sweet-chilli",
    name: {
      ro: "Sos sweet chilli (în preparat)",
      ru: "Соус сладкий чили (в блюдо)",
    },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "sos-mustar-miere",
    name: {
      ro: "Sos de muștar-miere (în preparat)",
      ru: "Горчично-медовый соус (в блюдо)",
    },
    price: 15,
    kind: "ingredient",
  },
  {
    id: "sosiera-apetit-dulce",
    name: { ro: "Sosieră Apetit dulce", ru: "Соусник Apetit сладкий" },
    price: 15,
    kind: "sauce-cup",
  },
  {
    id: "sosiera-apetit-picant",
    name: { ro: "Sosieră Apetit picant", ru: "Соусник Apetit острый" },
    price: 15,
    kind: "sauce-cup",
  },
  {
    id: "sosiera-cascaval",
    name: { ro: "Sosieră cașcaval", ru: "Соусник сырный" },
    price: 15,
    kind: "sauce-cup",
  },
  {
    id: "sosiera-cascaval-ketchup",
    name: { ro: "Sosieră cașcaval / ketchup", ru: "Соусник сырный / кетчуп" },
    price: 15,
    kind: "sauce-cup",
  },
  {
    id: "sosiera-maioneza",
    name: { ro: "Sosieră maioneză", ru: "Соусник майонез" },
    price: 10,
    kind: "sauce-cup",
  },
  {
    id: "sosiera-maioneza-ketchup",
    name: { ro: "Sosieră maioneză / ketchup", ru: "Соусник майонез / кетчуп" },
    price: 10,
    kind: "sauce-cup",
  },
  {
    id: "sosiera-ketchup",
    name: { ro: "Sosieră ketchup", ru: "Соусник кетчуп" },
    price: 8,
    kind: "sauce-cup",
  },
];
