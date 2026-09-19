// Блюда — SPEC приложение А (цены базовые, Briceni; состав — как в печатном
// меню). Slug = имя файла фото в assets/foto-originale (SPEC 2.7).
// TODO ru: проверить — ВСЕ русские названия и составы в этом файле черновые.
//
// Что не сказано в SPEC явно и требует подтверждения (см. PROGRESS.md):
// - кебабы и бургеры: база из SPEC + отличительный ингредиент из названия
//   (как в утверждённом макете): cașcaval, crispy, vită, carne de pui…
// - названия сэндвичей и салатов дополнены словом категории;
// - цены соусов отдельно — по печатному меню (ketchup 10, maioneză 15);
// - removable (что можно убрать) = состав без основы (lipie, chiflă, tortilla,
//   ciabatta). У комбо (категория menu) убрать нечего: в «составе» там части
//   набора (kebab mic, limonadă…), а не ингредиенты — вопрос в PROGRESS.md.
import type { LocalizedList, Product, Removable, Variant } from "./schema";

/** Основа блюда — её убрать нельзя, остальной состав можно (бесплатно). */
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

function removableFrom(ingredients: LocalizedList): Removable[] {
  return ingredients.ro
    .map((ro, i) => ({ id: slugify(ro), name: { ro, ru: ingredients.ru[i] } }))
    .filter((r) => !BASE_INGREDIENTS.has(r.name.ro));
}

type ProductInput = {
  slug: string;
  category: Product["category"];
  name: Product["name"];
  price: number;
  grams?: number | null;
  ingredients?: LocalizedList;
  variants?: Variant[] | null;
  photo?: string | null;
};

/** Блюдо с фото (photo = slug), без вариантов, если не сказано иначе. */
function product(input: ProductInput): Product {
  const ingredients = input.ingredients ?? { ro: [], ru: [] };
  return {
    slug: input.slug,
    category: input.category,
    name: input.name,
    ingredients,
    grams: input.grams ?? null,
    price: input.price,
    variants: input.variants ?? null,
    removable: input.category === "menu" ? [] : removableFrom(ingredients),
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
    category: "kebab",
    name: { ro: "Kebab Philly Beef", ru: "Кебаб Филли Биф" },
    price: 94,
    grams: 360,
    ingredients: kebab(["vită", "cașcaval"], ["говядина", "сыр"]),
  }),
  product({
    slug: "kebab-cheese",
    category: "kebab",
    name: { ro: "Kebab Cheese", ru: "Кебаб Чиз" },
    price: 105,
    grams: 440,
    ingredients: kebab(["cașcaval"], ["сыр"]),
  }),
  product({
    slug: "kebab-crispy",
    category: "kebab",
    name: { ro: "Kebab Crispy", ru: "Кебаб Криспи" },
    price: 90,
    grams: 360,
    ingredients: kebab(["crispy"], ["криспи"]),
  }),
  product({
    slug: "kebab-xl-xxl",
    category: "kebab",
    name: { ro: "Kebab XL / XXL", ru: "Кебаб XL / XXL" },
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
    name: { ro: "Kebab Menu XL / XXL", ru: "Кебаб Меню XL / XXL" },
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
    name: { ro: "Burger Menu XL / XXL", ru: "Бургер Меню XL / XXL" },
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
    category: "burgers",
    name: { ro: "Cheeseburger Dublu Pui", ru: "Двойной чизбургер с курицей" },
    price: 115,
    grams: 385,
    ingredients: burger(["carne de pui", "cașcaval"], ["куриное мясо", "сыр"]),
  }),
  product({
    slug: "cheeseburger-pui",
    category: "burgers",
    name: { ro: "Cheeseburger Pui", ru: "Чизбургер с курицей" },
    price: 85,
    grams: 290,
    ingredients: burger(["carne de pui", "cașcaval"], ["куриное мясо", "сыр"]),
  }),
  product({
    slug: "cheeseburger-dublu-vita",
    category: "burgers",
    name: {
      ro: "Cheeseburger Dublu Vită-Porc",
      ru: "Двойной чизбургер говядина-свинина",
    },
    price: 115,
    grams: 385,
    ingredients: burger(["vită-porc", "cașcaval"], ["говядина-свинина", "сыр"]),
  }),
  product({
    slug: "cheeseburger-vita",
    category: "burgers",
    name: { ro: "Cheeseburger Vită-Porc", ru: "Чизбургер говядина-свинина" },
    price: 85,
    grams: 290,
    ingredients: burger(["vită-porc", "cașcaval"], ["говядина-свинина", "сыр"]),
  }),
  product({
    slug: "hamburger-dublu-vita",
    category: "burgers",
    name: {
      ro: "Hamburger Dublu Vită-Porc",
      ru: "Двойной гамбургер говядина-свинина",
    },
    price: 105,
    grams: 365,
    ingredients: burger(["vită-porc"], ["говядина-свинина"]),
  }),
  product({
    slug: "hamburger-vita",
    category: "burgers",
    name: { ro: "Hamburger Vită-Porc", ru: "Гамбургер говядина-свинина" },
    price: 80,
    grams: 275,
    ingredients: burger(["vită-porc"], ["говядина-свинина"]),
  }),
  product({
    slug: "cheeseburger-crispy",
    category: "burgers",
    name: { ro: "Cheeseburger Crispy", ru: "Чизбургер Криспи" },
    price: 85,
    grams: 280,
    ingredients: burger(["crispy", "cașcaval"], ["криспи", "сыр"]),
  }),
];

// -------------------------------------------------------------- Gözleme ----
const GOZLEME: Product[] = [
  product({
    slug: "gozleme-mozzarella",
    category: "gozleme",
    name: { ro: "Gözleme Mozzarella", ru: "Гёзлеме с моцареллой" },
    price: 45,
    grams: 130,
    ingredients: list(
      ["tortilla", "sos", "mozzarella", "verdeață proaspătă"],
      ["тортилья", "соус", "моцарелла", "свежая зелень"],
    ),
  }),
  product({
    slug: "gozleme-carne",
    category: "gozleme",
    name: { ro: "Gözleme Carne de Pui", ru: "Гёзлеме с курицей" },
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
    name: { ro: "Aripioare", ru: "Крылышки" },
    price: 85,
    grams: 240,
    ingredients: list(["sos sweet chilli"], ["соус сладкий чили"]),
  }),
  product({
    slug: "crispy-filets",
    category: "crispy",
    name: { ro: "Crispy Filets", ru: "Криспи филе" },
    price: 85,
    grams: 180,
    ingredients: list(["sos usturoi"], ["чесночный соус"]),
  }),
  product({
    slug: "mozza-crispy",
    category: "crispy",
    name: { ro: "Mozza Crispy", ru: "Моцца Криспи" },
    price: 75,
    grams: 110,
    ingredients: list(["sos muștar/miere"], ["горчично-медовый соус"]),
  }),
  product({
    slug: "cartofi-pai",
    category: "crispy",
    name: { ro: "Cartofi pai", ru: "Картофель фри" },
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
    category: "hot-dog",
    name: { ro: "Hot Dog Classic", ru: "Хот-дог Классик" },
    price: 45,
    grams: 270,
    ingredients: list(
      ["maioneză", "ketchup", "crenvușcă", "varză", "morcov marinat"],
      ["майонез", "кетчуп", "сосиска", "капуста", "маринованная морковь"],
    ),
  }),
  product({
    slug: "hot-dog-cheese",
    category: "hot-dog",
    name: { ro: "Hot Dog Cheese", ru: "Хот-дог Чиз" },
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
    category: "sandwich",
    name: {
      ro: "Sandwich cu salam fiert-afumat",
      ru: "Сэндвич с варёно-копчёной салями",
    },
    price: 55,
    grams: 218,
    ingredients: list(
      ["ciabatta", "sos", "frunză de salată", "salam", "castraveți"],
      ["чиабатта", "соус", "лист салата", "салями", "огурцы"],
    ),
  }),
  product({
    slug: "sandwich-sunca",
    category: "sandwich",
    name: {
      ro: "Sandwich cu șuncă de găină",
      ru: "Сэндвич с куриной ветчиной",
    },
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
    name: { ro: "Salată Grecească", ru: "Греческий салат" },
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
    name: { ro: "Salată Cezar", ru: "Салат Цезарь" },
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
    name: { ro: "Margarita", ru: "Маргарита" },
    price: 115,
    grams: 520,
    ingredients: list(
      ["mozzarella", "felii de mozzarella", "sos de tomate"],
      ["моцарелла", "ломтики моцареллы", "томатный соус"],
    ),
  }),
  product({
    slug: "pizza-quattro-formaggi",
    category: "pizza",
    name: { ro: "Quattro Formaggi", ru: "Кватро Формаджи" },
    price: 125,
    grams: 550,
    ingredients: list(
      ["mozzarella", "gouda", "brânză mucegai", "parmezan", "sos alb"],
      ["моцарелла", "гауда", "сыр с плесенью", "пармезан", "белый соус"],
    ),
  }),
  product({
    slug: "pizza-quattro-formaggi-cu-para",
    category: "pizza",
    name: { ro: "Quattro Formaggi cu Pară", ru: "Кватро Формаджи с грушей" },
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
    category: "pizza",
    name: { ro: "Pepperoni", ru: "Пепперони" },
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
    name: { ro: "Carbonara", ru: "Карбонара" },
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
    category: "pizza",
    name: { ro: "4 Cărnuri", ru: "4 вида мяса" },
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
    category: "pizza",
    name: { ro: "Șuncă și Legume", ru: "Ветчина и овощи" },
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
    name: { ro: "Sos de usturoi", ru: "Чесночный соус" },
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-cascaval",
    category: "sosuri",
    name: { ro: "Sos cașcaval", ru: "Сырный соус" },
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-sweet-chilli",
    category: "sosuri",
    name: { ro: "Sos sweet chilli", ru: "Соус сладкий чили" },
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-ketchup",
    category: "sosuri",
    name: { ro: "Ketchup", ru: "Кетчуп" },
    price: 10,
    grams: 50,
  }),
  product({
    slug: "sos-mustar-miere",
    category: "sosuri",
    name: { ro: "Sos de muștar-miere", ru: "Горчично-медовый соус" },
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-maioneza",
    category: "sosuri",
    name: { ro: "Maioneză", ru: "Майонез" },
    price: 15,
    grams: 50,
  }),
  product({
    slug: "sos-apetit",
    category: "sosuri",
    name: {
      ro: "Sos Apetit (dulce / picant)",
      ru: "Соус Apetit (сладкий / острый)",
    },
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
    name: {
      ro: "Limonadă Aloe-Fresh (250 ml)",
      ru: "Лимонад Алоэ-Фреш (250 мл)",
    },
    price: 30,
    photo: null,
  }),
  product({
    slug: "limonada-portocala",
    category: "drinks",
    name: {
      ro: "Limonadă Portocală (250 ml)",
      ru: "Лимонад Апельсин (250 мл)",
    },
    price: 30,
    photo: null,
  }),
  product({
    slug: "cola",
    category: "drinks",
    name: { ro: "Coca-Cola", ru: "Кока-Кола" },
    price: 22,
  }),
  product({
    slug: "fanta",
    category: "drinks",
    name: { ro: "Fanta", ru: "Фанта" },
    price: 22,
  }),
  product({
    slug: "sprite",
    category: "drinks",
    name: { ro: "Sprite", ru: "Спрайт" },
    price: 22,
  }),
  product({
    slug: "apa-plata",
    category: "drinks",
    name: { ro: "Apă plată", ru: "Вода негазированная" },
    price: 18,
  }),
  product({
    slug: "apa-gazata",
    category: "drinks",
    name: { ro: "Apă gazată", ru: "Вода газированная" },
    price: 18,
  }),
  product({
    slug: "ceai-craft",
    category: "drinks",
    name: { ro: "Ceai craft", ru: "Крафтовый чай" },
    price: 28,
    photo: null,
  }),
  product({
    slug: "espresso",
    category: "drinks",
    name: { ro: "Espresso", ru: "Эспрессо" },
    price: 22,
    photo: null,
  }),
  product({
    slug: "americano",
    category: "drinks",
    name: { ro: "Americano", ru: "Американо" },
    price: 22,
    photo: null,
  }),
  product({
    slug: "latte",
    category: "drinks",
    name: { ro: "Latte", ru: "Латте" },
    price: 28,
    photo: null,
  }),
  product({
    slug: "cappuccino",
    category: "drinks",
    name: { ro: "Cappuccino", ru: "Капучино" },
    price: 28,
    photo: null,
  }),
  product({
    slug: "le-coq-margarita",
    category: "drinks",
    name: { ro: "Le Coq Margarita (0 %)", ru: "Le Coq Маргарита (0 %)" },
    price: 36,
  }),
  product({
    slug: "le-coq-mojito",
    category: "drinks",
    name: { ro: "Le Coq Mojito (0 %)", ru: "Le Coq Мохито (0 %)" },
    price: 36,
  }),
];

// --------------------------------------------------------------- Desert ----
const DESERT: Product[] = [
  product({
    slug: "brinzoaice",
    category: "desert",
    name: { ro: "Brânzoaice (+ gem / iaurt)", ru: "Сырники (+ джем / йогурт)" },
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
    name: { ro: "Supă cremă de ciuperci", ru: "Грибной крем-суп" },
    price: 80,
  }),
  product({
    slug: "supa-bostan",
    category: "supe",
    name: { ro: "Supă cremă de bostan", ru: "Тыквенный крем-суп" },
    price: 80,
  }),
  product({
    slug: "supa-spanac",
    category: "supe",
    name: { ro: "Supă cremă de spanac", ru: "Шпинатный крем-суп" },
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
