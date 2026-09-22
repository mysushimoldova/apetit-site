// Блюда — SPEC приложение А (цены базовые, Briceni; состав — как в печатном
// меню). Slug = имя файла фото в assets/foto-originale (SPEC 2.7).
// Названия блюд не переводятся и не транслитерируются: в русской версии они
// такие же, как в румынском меню (решение архитектора 22.09.2026) — поэтому
// name здесь одна строка на оба языка. Переводятся состав и названия
// вариантов. TODO ru: проверить — русские СОСТАВЫ в этом файле черновые.
//
// Что не сказано в SPEC явно и требует подтверждения (см. PROGRESS.md):
// - кебабы и бургеры: база из SPEC + отличительный ингредиент из названия
//   (как в утверждённом макете): cașcaval, crispy, vită, carne de pui…
// - названия сэндвичей и салатов дополнены словом категории;
// - цены соусов отдельно — по печатному меню (ketchup 10, maioneză 15);
// - removable (что можно убрать) = состав без базы. База (ответ архитектора):
//   хлеб (lipie, chiflă, tortilla, ciabatta) + главный ингредиент — то, что
//   стоит в названии блюда (поле main). У комбо (категория menu) блока «Fără»
//   нет: в «составе» там части набора (kebab mic, limonadă…).
import type { LocalizedList, Product, Removable, Variant } from "./schema";

/** Хлеб — часть базы любого блюда: убрать нельзя. */
const BASE_INGREDIENTS = new Set(["lipie", "chiflă", "tortilla", "ciabatta"]);

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ț/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Всё, кроме базы (хлеб + main), можно убрать бесплатно. */
function removableFrom(
  ingredients: LocalizedList,
  main: readonly string[],
): Removable[] {
  const base = new Set([...BASE_INGREDIENTS, ...main]);
  return ingredients.ro
    .map((ro, i) => ({ id: slugify(ro), name: { ro, ru: ingredients.ru[i] } }))
    .filter((r) => !base.has(r.name.ro));
}

type ProductInput = {
  slug: string;
  category: Product["category"];
  /** Одно название на оба языка — в русской версии оно не переводится. */
  name: string;
  price: number;
  grams?: number | null;
  ingredients?: LocalizedList;
  variants?: Variant[] | null;
  photo?: string | null;
  /** Главный ингредиент из названия (ro, как в составе) — часть базы. */
  main?: string[];
};

/** Блюдо с фото (photo = slug), без вариантов, если не сказано иначе. */
function product(input: ProductInput): Product {
  const ingredients = input.ingredients ?? { ro: [], ru: [] };
  const main = input.main ?? [];
  // Опечатка в main тихо сделала бы главный ингредиент убираемым
  for (const m of main) {
    if (!ingredients.ro.includes(m)) {
      throw new Error(`${input.slug}: main «${m}» нет в составе`);
    }
  }
  return {
    slug: input.slug,
    category: input.category,
    name: { ro: input.name, ru: input.name },
    ingredients,
    grams: input.grams ?? null,
    price: input.price,
    variants: input.variants ?? null,
    removable:
      input.category === "menu" ? [] : removableFrom(ingredients, main),
    photo: input.photo === undefined ? input.slug : input.photo,
    active: true,
  };
}

const list = (ro: string[], ru: string[]): LocalizedList => ({ ro, ru });

// ---------------------------------------------------------------- Kebab ----
// SPEC: все кебабы содержат lipie, maioneză, salată iceberg/varză, roșii,
// castraveți murați, sos kebab, ketchup.
const KEBAB_BASE = list(
  [
    "maioneză",
    "salată iceberg/varză",
    "roșii",
    "castraveți murați",
    "sos kebab",
    "ketchup",
  ],
  [
    "майонез",
    "салат айсберг/капуста",
    "помидоры",
    "маринованные огурцы",
    "соус кебаб",
    "кетчуп",
  ],
);
const kebab = (extraRo: string[], extraRu: string[]) =>
  list(
    ["lipie", ...extraRo, ...KEBAB_BASE.ro],
    ["лаваш", ...extraRu, ...KEBAB_BASE.ru],
  );

const KEBAB: Product[] = [
  product({
    slug: "kebab-philly-beef",
    main: ["vită"],
    category: "kebab",
    name: "Kebab Philly Beef",
    price: 94,
    grams: 360,
    ingredients: kebab(["vită", "cașcaval"], ["говядина", "сыр"]),
  }),
  product({
    slug: "kebab-cheese",
    main: ["cașcaval"],
    category: "kebab",
    name: "Kebab Cheese",
    price: 105,
    grams: 440,
    ingredients: kebab(["cașcaval"], ["сыр"]),
  }),
  product({
    slug: "kebab-crispy",
    main: ["crispy"],
    category: "kebab",
    name: "Kebab Crispy",
    price: 90,
    grams: 360,
    ingredients: kebab(["crispy"], ["криспи"]),
  }),
  product({
    slug: "kebab-xl-xxl",
    category: "kebab",
    name: "Kebab XL / XXL",
    price: 80,
    grams: null,
    ingredients: kebab([], []),
    variants: [
      {
        id: "xl",
        name: { ro: "XL", ru: "XL" },
        price: 80,
        grams: 340,
        ingredients: null,
      },
      {
        id: "xxl",
        name: { ro: "XXL", ru: "XXL" },
        price: 99,
        grams: 430,
        ingredients: null,
      },
    ],
  }),
];

// ----------------------------------------------------------- Menu (комбо) ----
const MENU: Product[] = [
  product({
    slug: "kebab-menu",
    category: "menu",
    name: "Kebab Menu XL / XXL",
    price: 130,
    ingredients: list(
      ["sos", "limonadă", "kebab mic", "cartofi pai mic"],
      ["соус", "лимонад", "кебаб малый", "картофель фри малый"],
    ),
    variants: [
      {
        id: "xl",
        name: { ro: "XL", ru: "XL" },
        price: 130,
        grams: null,
        ingredients: list(
          ["sos", "limonadă", "kebab mic", "cartofi pai mic"],
          ["соус", "лимонад", "кебаб малый", "картофель фри малый"],
        ),
      },
      {
        id: "xxl",
        name: { ro: "XXL", ru: "XXL" },
        price: 170,
        grams: null,
        ingredients: list(
          ["sos", "limonadă", "kebab mare", "cartofi pai mari"],
          ["соус", "лимонад", "кебаб большой", "картофель фри большой"],
        ),
      },
    ],
  }),
  product({
    slug: "burger-menu",
    category: "menu",
    name: "Burger Menu XL / XXL",
    price: 130,
    ingredients: list(
      ["sos", "limonadă", "cheeseburger mic", "cartofi pai mic"],
      ["соус", "лимонад", "чизбургер малый", "картофель фри малый"],
    ),
    variants: [
      {
        id: "xl",
        name: { ro: "XL", ru: "XL" },
        price: 130,
        grams: null,
        ingredients: list(
          ["sos", "limonadă", "cheeseburger mic", "cartofi pai mic"],
          ["соус", "лимонад", "чизбургер малый", "картофель фри малый"],
        ),
      },
      {
        id: "xxl",
        name: { ro: "XXL", ru: "XXL" },
        price: 170,
        grams: null,
        ingredients: list(
          ["sos", "limonadă", "cheeseburger dublu", "cartofi pai mari"],
          ["соус", "лимонад", "двойной чизбургер", "картофель фри большой"],
        ),
      },
    ],
  }),
];

// -------------------------------------------------------------- Burgers ----
// SPEC: все бургеры содержат chiflă, sos, salată iceberg, roșii, castraveți
// marinați, ceapă marinată/ceapă confi.
const BURGER_BASE = list(
  [
    "sos",
    "salată iceberg",
    "roșii",
    "castraveți marinați",
    "ceapă marinată/ceapă confi",
  ],
  [
    "соус",
    "салат айсберг",
    "помидоры",
    "маринованные огурцы",
    "маринованный лук/лук конфи",
  ],
);
const burger = (extraRo: string[], extraRu: string[]) =>
  list(
    ["chiflă", ...extraRo, ...BURGER_BASE.ro],
    ["булочка", ...extraRu, ...BURGER_BASE.ru],
  );

const BURGERS: Product[] = [
  product({
    slug: "cheeseburger-dublu-pui",
    main: ["carne de pui", "cașcaval"],
    category: "burgers",
    name: "Cheeseburger Dublu Pui",
    price: 115,
    grams: 385,
    ingredients: burger(["carne de pui", "cașcaval"], ["куриное мясо", "сыр"]),
  }),
  product({
    slug: "cheeseburger-pui",
    main: ["carne de pui", "cașcaval"],
    category: "burgers",
    name: "Cheeseburger Pui",
    price: 85,
    grams: 290,
    ingredients: burger(["carne de pui", "cașcaval"], ["куриное мясо", "сыр"]),
  }),
  product({
    slug: "cheeseburger-dublu-vita",
    main: ["vită-porc", "cașcaval"],
    category: "burgers",
    name: "Cheeseburger Dublu Vită-Porc",
    price: 115,
    grams: 385,
    ingredients: burger(["vită-porc", "cașcaval"], ["говядина-свинина", "сыр"]),
  }),
  product({
    slug: "cheeseburger-vita",
    main: ["vită-porc", "cașcaval"],
    category: "burgers",
    name: "Cheeseburger Vită-Porc",
    price: 85,
    grams: 290,
    ingredients: burger(["vită-porc", "cașcaval"], ["говядина-свинина", "сыр"]),
  }),
  product({
    slug: "hamburger-dublu-vita",
    main: ["vită-porc"],
    category: "burgers",
    name: "Hamburger Dublu Vită-Porc",
    price: 105,
    grams: 365,
    ingredients: burger(["vită-porc"], ["говядина-свинина"]),
  }),
  product({
    slug: "hamburger-vita",
    main: ["vită-porc"],
    category: "burgers",
    name: "Hamburger Vită-Porc",
    price: 80,
    grams: 275,
    ingredients: burger(["vită-porc"], ["говядина-свинина"]),
  }),
  product({
    slug: "cheeseburger-crispy",
    main: ["crispy", "cașcaval"],
    category: "burgers",
    name: "Cheeseburger Crispy",
    price: 85,
    grams: 280,
    ingredients: burger(["crispy", "cașcaval"], ["криспи", "сыр"]),
  }),
];

// -------------------------------------------------------------- Gözleme ----
const GOZLEME: Product[] = [
  product({
    slug: "gozleme-mozzarella",
    main: ["mozzarella"],
    category: "gozleme",
    name: "Gözleme Mozzarella",
    price: 45,
    grams: 130,
    ingredients: list(
      ["tortilla", "sos", "mozzarella", "verdeață proaspătă"],
      ["тортилья", "соус", "моцарелла", "свежая зелень"],
    ),
  }),
  product({
    slug: "gozleme-carne",
    main: ["carne de pui"],
    category: "gozleme",
    name: "Gözleme Carne de Pui",
    price: 55,
    grams: 250,
    ingredients: list(
      ["tortilla", "sos", "mozzarella", "carne de pui", "ketchup"],
      ["тортилья", "соус", "моцарелла", "куриное мясо", "кетчуп"],
    ),
  }),
];

// --------------------------------------------------------------- Crispy ----
const CRISPY: Product[] = [
  product({
    slug: "aripioare",
    category: "crispy",
    name: "Aripioare",
    price: 85,
    grams: 240,
    ingredients: list(["sos sweet chilli"], ["соус сладкий чили"]),
  }),
  product({
    slug: "crispy-filets",
    category: "crispy",
    name: "Crispy Filets",
    price: 85,
    grams: 180,
    ingredients: list(["sos usturoi"], ["чесночный соус"]),
  }),
  product({
    slug: "mozza-crispy",
    category: "crispy",
    name: "Mozza Crispy",
    price: 75,
    grams: 110,
    ingredients: list(["sos muștar/miere"], ["горчично-медовый соус"]),
  }),
  product({
    slug: "cartofi-pai",
    category: "crispy",
    name: "Cartofi pai",
    price: 23,
    grams: null,
    variants: [
      {
        id: "mic",
        name: { ro: "mic", ru: "малый" },
        price: 23,
        grams: 120,
        ingredients: null,
      },
      {
        id: "mare",
        name: { ro: "mare", ru: "большой" },
        price: 30,
        grams: 180,
        ingredients: null,
      },
    ],
  }),
];

// -------------------------------------------------------------- Hot Dog ----
const HOT_DOG: Product[] = [
  product({
    slug: "hot-dog-classic",
    main: ["crenvușcă"],
    category: "hot-dog",
    name: "Hot Dog Classic",
    price: 45,
    grams: 270,
    ingredients: list(
      ["maioneză", "ketchup", "crenvușcă", "varză", "morcov marinat"],
      ["майонез", "кетчуп", "сосиска", "капуста", "маринованная морковь"],
    ),
  }),
  product({
    slug: "hot-dog-cheese",
    main: ["crenvușcă", "cașcaval"],
    category: "hot-dog",
    name: "Hot Dog Cheese",
    price: 55,
    grams: 238,
    ingredients: list(
      ["maioneză", "ketchup", "cașcaval", "crenvușcă", "ceapă caramelizată"],
      ["майонез", "кетчуп", "сыр", "сосиска", "карамелизированный лук"],
    ),
  }),
];

// ------------------------------------------------------------- Sandwich ----
const SANDWICH: Product[] = [
  product({
    slug: "sandwich-salam",
    main: ["salam"],
    category: "sandwich",
    name: "Sandwich cu salam fiert-afumat",
    price: 55,
    grams: 218,
    ingredients: list(
      ["ciabatta", "sos", "frunză de salată", "salam", "castraveți"],
      ["чиабатта", "соус", "лист салата", "салями", "огурцы"],
    ),
  }),
  product({
    slug: "sandwich-sunca",
    main: ["șuncă"],
    category: "sandwich",
    name: "Sandwich cu șuncă de găină",
    price: 55,
    grams: 222,
    ingredients: list(
      ["ciabatta", "sos", "frunză de salată", "șuncă", "roșii"],
      ["чиабатта", "соус", "лист салата", "ветчина", "помидоры"],
    ),
  }),
];

// ---------------------------------------------------------------- Salad ----
const SALAD: Product[] = [
  product({
    slug: "salata-greceasca",
    category: "salad",
    name: "Salată Grecească",
    price: 75,
    grams: 280,
    ingredients: list(
      [
        "salată iceberg",
        "feta",
        "roșii",
        "castraveți",
        "măsline",
        "ceapă roșie",
        "oregano",
        "sos",
      ],
      [
        "салат айсберг",
        "фета",
        "помидоры",
        "огурцы",
        "маслины",
        "красный лук",
        "орегано",
        "соус",
      ],
    ),
  }),
  product({
    slug: "salata-cezar",
    category: "salad",
    name: "Salată Cezar",
    price: 80,
    grams: 245,
    ingredients: list(
      ["salată iceberg", "roșii", "crispy filets", "parmezan", "sos cezar"],
      ["салат айсберг", "помидоры", "криспи филе", "пармезан", "соус цезарь"],
    ),
  }),
];

// ---------------------------------------------------------------- Pizza ----
// Не во всех точках; в Сороках нет (см. point-products.ts).
const PIZZA: Product[] = [
  product({
    slug: "pizza-margarita",
    category: "pizza",
    name: "Margarita",
    price: 115,
    grams: 520,
    ingredients: list(
      ["mozzarella", "felii de mozzarella", "sos de tomate"],
      ["моцарелла", "ломтики моцареллы", "томатный соус"],
    ),
  }),
  product({
    slug: "pizza-quattro-formaggi",
    main: ["mozzarella", "gouda", "brânză mucegai", "parmezan"],
    category: "pizza",
    name: "Quattro Formaggi",
    price: 125,
    grams: 550,
    ingredients: list(
      ["mozzarella", "gouda", "brânză mucegai", "parmezan", "sos alb"],
      ["моцарелла", "гауда", "сыр с плесенью", "пармезан", "белый соус"],
    ),
  }),
  product({
    slug: "pizza-quattro-formaggi-cu-para",
    main: ["mozzarella", "gouda", "brânză mucegai", "parmezan", "pere"],
    category: "pizza",
    name: "Quattro Formaggi cu Pară",
    price: 135,
    grams: 570,
    ingredients: list(
      ["mozzarella", "gouda", "brânză mucegai", "parmezan", "pere", "sos alb"],
      [
        "моцарелла",
        "гауда",
        "сыр с плесенью",
        "пармезан",
        "груша",
        "белый соус",
      ],
    ),
  }),
  product({
    slug: "pizza-pepperoni",
    main: ["salam crud-afumat"],
    category: "pizza",
    name: "Pepperoni",
    price: 145,
    grams: 520,
    ingredients: list(
      [
        "salam crud-afumat",
        "mozzarella",
        "ardei",
        "ceapă",
        "măsline verzi",
        "ardei iute verde",
      ],
      [
        "сырокопчёная салями",
        "моцарелла",
        "перец",
        "лук",
        "зелёные оливки",
        "зелёный острый перец",
      ],
    ),
  }),
  product({
    slug: "pizza-carbonara",
    category: "pizza",
    name: "Carbonara",
    price: 145,
    grams: 550,
    ingredients: list(
      [
        "șuncă de pui",
        "bacon",
        "mozzarella",
        "parmezan",
        "ceapă marinată",
        "sos alb",
      ],
      [
        "куриная ветчина",
        "бекон",
        "моцарелла",
        "пармезан",
        "маринованный лук",
        "белый соус",
      ],
    ),
  }),
  product({
    slug: "pizza-4-carnuri",
    main: ["piept de pui sous-vide", "șuncă de pui", "salam", "bacon"],
    category: "pizza",
    name: "4 Cărnuri",
    price: 155,
    grams: 560,
    ingredients: list(
      [
        "piept de pui sous-vide",
        "șuncă de pui",
        "salam",
        "bacon",
        "mozzarella",
        "sos de tomate",
      ],
      [
        "куриная грудка су-вид",
        "куриная ветчина",
        "салями",
        "бекон",
        "моцарелла",
        "томатный соус",
      ],
    ),
  }),
  product({
    slug: "pizza-sunca-si-legume",
    main: ["șuncă de pui"],
    category: "pizza",
    name: "Șuncă și Legume",
    price: 125,
    grams: 570,
    ingredients: list(
      [
        "șuncă de pui",
        "ciuperci",
        "ardei",
        "ceapă",
        "măsline verzi",
        "mozzarella",
        "sos de tomate",
      ],
      [
        "куриная ветчина",
        "грибы",
        "перец",
        "лук",
        "зелёные оливки",
        "моцарелла",
        "томатный соус",
      ],
    ),
  }),
];

// --------------------------------------------------------------- Sosuri ----
// Отдельно, 50 g. Цены — печатное меню (касса: ketchup 8, maioneză 10) — УТОЧНИТЬ.
const SOSURI: Product[] = [
  product({
    slug: "sos-usturoi",
    category: "sosuri",
    name: "Sos de usturoi",
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-cascaval",
    category: "sosuri",
    name: "Sos cașcaval",
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-sweet-chilli",
    category: "sosuri",
    name: "Sos sweet chilli",
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-ketchup",
    category: "sosuri",
    name: "Ketchup",
    price: 10,
    grams: 50,
  }),
  product({
    slug: "sos-mustar-miere",
    category: "sosuri",
    name: "Sos de muștar-miere",
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-maioneza",
    category: "sosuri",
    name: "Maioneză",
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-apetit",
    category: "sosuri",
    name: "Sos Apetit (dulce / picant)",
    price: 15,
    grams: 50,
    variants: [
      {
        id: "dulce",
        name: { ro: "dulce", ru: "сладкий" },
        price: 15,
        grams: 50,
        ingredients: null,
      },
      {
        id: "picant",
        name: { ro: "picant", ru: "острый" },
        price: 15,
        grams: 50,
        ingredients: null,
      },
    ],
  }),
];

// --------------------------------------------------------------- Drinks ----
// SPEC: УТОЧНИТЬ, для каких точек. Без фото: лимонады, чай, кофе (SPEC 2.7).
const DRINKS: Product[] = [
  product({
    slug: "limonada-aloe-fresh",
    category: "drinks",
    name: "Limonadă Aloe-Fresh (250 ml)",
    price: 30,
    photo: null,
  }),
  product({
    slug: "limonada-portocala",
    category: "drinks",
    name: "Limonadă Portocală (250 ml)",
    price: 30,
    photo: null,
  }),
  product({
    slug: "cola",
    category: "drinks",
    name: "Coca-Cola",
    price: 22,
  }),
  product({
    slug: "fanta",
    category: "drinks",
    name: "Fanta",
    price: 22,
  }),
  product({
    slug: "sprite",
    category: "drinks",
    name: "Sprite",
    price: 22,
  }),
  product({
    slug: "apa-plata",
    category: "drinks",
    name: "Apă plată",
    price: 18,
  }),
  product({
    slug: "apa-gazata",
    category: "drinks",
    name: "Apă gazată",
    price: 18,
  }),
  product({
    slug: "ceai-craft",
    category: "drinks",
    name: "Ceai craft",
    price: 28,
    photo: null,
  }),
  product({
    slug: "espresso",
    category: "drinks",
    name: "Espresso",
    price: 22,
    photo: null,
  }),
  product({
    slug: "americano",
    category: "drinks",
    name: "Americano",
    price: 22,
    photo: null,
  }),
  product({
    slug: "latte",
    category: "drinks",
    name: "Latte",
    price: 28,
    photo: null,
  }),
  product({
    slug: "cappuccino",
    category: "drinks",
    name: "Cappuccino",
    price: 28,
    photo: null,
  }),
  product({
    slug: "le-coq-margarita",
    category: "drinks",
    name: "Le Coq Margarita (0 %)",
    price: 36,
  }),
  product({
    slug: "le-coq-mojito",
    category: "drinks",
    name: "Le Coq Mojito (0 %)",
    price: 36,
  }),
];

// --------------------------------------------------------------- Desert ----
const DESERT: Product[] = [
  product({
    slug: "brinzoaice",
    category: "desert",
    name: "Brânzoaice (+ gem / iaurt)",
    price: 50,
    grams: 120,
  }),
];

// ----------------------------------------------------------------- Supe ----
// SPEC: УТОЧНИТЬ, продаются ли. Пока выключены везде (point-products.ts).
const SUPE: Product[] = [
  product({
    slug: "supa-ciuperci",
    category: "supe",
    name: "Supă cremă de ciuperci",
    price: 80,
  }),
  product({
    slug: "supa-bostan",
    category: "supe",
    name: "Supă cremă de bostan",
    price: 80,
  }),
  product({
    slug: "supa-spanac",
    category: "supe",
    name: "Supă cremă de spanac",
    price: 80,
  }),
];

/** Все блюда каталога в порядке показа (категории — в порядке SPEC). */
export const PRODUCTS: readonly Product[] = [
  ...KEBAB,
  ...MENU,
  ...BURGERS,
  ...GOZLEME,
  ...CRISPY,
  ...HOT_DOG,
  ...SANDWICH,
  ...SALAD,
  ...PIZZA,
  ...SOSURI,
  ...DRINKS,
  ...DESERT,
  ...SUPE,
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}
