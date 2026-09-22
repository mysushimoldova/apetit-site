import { expect, test, type Page } from "@playwright/test";

// Русские адреса /ru/, переключатель RO/RU, память языка, контакты, подвал,
// sitemap/robots, hreflang/canonical, Schema.org. Профиль — телефон 390px.

const OPEN = "2026-09-19T09:00:00Z"; // 12:00 в Кишинёве

const CART = {
  state: {
    city: "soroca",
    lines: [
      {
        productSlug: "kebab-cheese",
        variantId: null,
        addonIds: [],
        removedIds: [],
        qty: 1,
      },
    ],
  },
  version: 1,
};

function seed(page: Page, items: Record<string, string>) {
  return page.addInitScript((entries) => {
    for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
  }, items);
}

const langNav = (page: Page, label: string) =>
  page.getByRole("navigation", { name: label });

test.describe("обе языковые ветки", () => {
  for (const [ro, ru] of [
    ["/", "/ru"],
    ["/soroca", "/ru/soroca"],
    ["/contacte", "/ru/contacte"],
    ["/termeni", "/ru/termeni"],
  ]) {
    test(`${ro} ↔ ${ru}: lang, canonical, hreflang`, async ({ page }) => {
      for (const [path, lang, other] of [
        [ro, "ro", ru],
        [ru, "ru", ro],
      ]) {
        const res = await page.goto(path);
        expect(res?.status()).toBe(200);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        const canonical = page.locator('link[rel="canonical"]');
        await expect(canonical).toHaveAttribute(
          "href",
          `https://apetit.md${path === "/" ? "" : path}`,
        );
        await expect(
          page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
        ).toHaveAttribute(
          "href",
          `https://apetit.md${path === "/" ? "" : path}`,
        );
        await expect(
          page.locator(`link[rel="alternate"][hreflang="x-default"]`),
        ).toHaveAttribute("href", `https://apetit.md${ro === "/" ? "" : ro}`);
        await expect(
          page.locator(
            `link[rel="alternate"][hreflang="${lang === "ro" ? "ru" : "ro"}"]`,
          ),
        ).toHaveAttribute(
          "href",
          `https://apetit.md${other === "/" ? "" : other}`,
        );
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          /.{20,}/,
        );
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
          "content",
          /^https:\/\/apetit\.md\/og\/[a-z]+\.png$/,
        );
      }
    });
  }

  test("заголовки вкладок разные на языках", async ({ page }) => {
    await page.goto("/soroca");
    await expect(page).toHaveTitle(
      "Apetit Soroca — kebab, burgeri, comandă online",
    );
    await page.goto("/ru/soroca");
    await expect(page).toHaveTitle(
      "Apetit Soroca — кебаб, бургеры, заказ онлайн",
    );
    await page.goto("/ru/contacte");
    await expect(page).toHaveTitle("Контакты — Apetit");
  });

  test("неизвестный город на /ru → 404", async ({ page }) => {
    expect((await page.goto("/ru/chisinau"))?.status()).toBe(404);
    expect((await page.goto("/ru/floresti"))?.status()).toBe(404);
  });
});

test.describe("переключатель RO/RU", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(OPEN));
    await page.setExtraHTTPHeaders({ "x-apetit-test-now": OPEN });
  });

  test("в меню: тот же экран, корзина и город на месте", async ({ page }) => {
    await seed(page, { "apetit.cart": JSON.stringify(CART) });
    await page.goto("/soroca");
    await expect(page.locator(".cart-bar[data-visible]")).toBeVisible();
    // Текущий язык — не ссылка
    const nav = langNav(page, "Limba");
    await expect(nav.getByRole("link")).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "RU" })).toHaveAttribute(
      "href",
      "/ru/soroca",
    );
    await nav.getByRole("link", { name: "RU" }).click();
    await expect(page).toHaveURL(/\/ru\/soroca$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.locator(".cart-bar[data-visible]")).toContainText(
      "1 позиция",
    );
    await expect(page.getByRole("button", { name: /Soroca/ })).toBeVisible();
    // Выбор запомнен
    expect(await page.evaluate(() => localStorage.getItem("apetit.lang"))).toBe(
      "ru",
    );
    await langNav(page, "Язык").getByRole("link", { name: "RO" }).click();
    await expect(page).toHaveURL(/\/soroca$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  });

  test("на оформлении: введённые данные не теряются", async ({ page }) => {
    await seed(page, { "apetit.cart": JSON.stringify(CART) });
    await page.goto("/soroca/comanda");
    await page.getByText("Apetit Soroca Nouă").click();
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    await page.getByLabel("Nume").fill("Ion");
    await page.getByLabel("Telefon").pressSequentially("069123456");
    await page.getByLabel("Adresă").fill("Str. Test 1");

    await langNav(page, "Limba").getByRole("link", { name: "RU" }).click();
    await expect(page).toHaveURL(/\/ru\/soroca\/comanda$/);
    await expect(page.getByLabel("Имя")).toHaveValue("Ion");
    await expect(page.getByLabel("Телефон")).toHaveValue("069 123 456");
    await expect(page.getByLabel("Адрес")).toHaveValue("Str. Test 1");
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    // Корзина на месте (название блюда в русской версии — как в румынской)
    await expect(page.getByText("Kebab Cheese")).toBeVisible();
  });

  test("на подтверждении и контактах — тот же экран", async ({
    page,
    request,
  }) => {
    await page.goto("/contacte");
    await expect(
      langNav(page, "Limba").getByRole("link", { name: "RU" }),
    ).toHaveAttribute("href", "/ru/contacte");
    // Подтверждение без снимка заказа уводит в меню — смотрим HTML сервера
    const html = await (await request.get("/ru/soroca/comanda/1042")).text();
    expect(html).toContain('href="/soroca/comanda/1042"');
  });
});

test.describe("язык по умолчанию и память", () => {
  test("Otaci открывается на русском, остальные — на румынском", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Otaci" }).click();
    await expect(page).toHaveURL(/\/ru\/otaci$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    // Город запоминается после загрузки React
    await page.waitForFunction(
      () => localStorage.getItem("apetit.city") === "otaci",
    );
    // Повторное открытие «/» — снова на /ru/otaci
    await page.goto("/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/ru\/otaci$/);
  });

  test("выбранный язык уважается: Otaci на ro, Soroca на ru", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("apetit.lang", "ro"));
    await page.reload();
    await expect(page.getByRole("link", { name: "Otaci" })).toHaveAttribute(
      "href",
      "/otaci",
    );
    await page.evaluate(() => localStorage.setItem("apetit.lang", "ru"));
    await page.reload();
    await expect(page.getByRole("link", { name: "Soroca" })).toHaveAttribute(
      "href",
      "/ru/soroca",
    );
    await page.evaluate(() => localStorage.setItem("apetit.city", "soroca"));
    await page.goto("/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/ru\/soroca$/);
  });

  test("на /ru все плитки ведут на /ru/…; «сменить город» → /ru", async ({
    page,
  }) => {
    await page.goto("/ru");
    await expect(page.getByRole("link", { name: "Soroca" })).toHaveAttribute(
      "href",
      "/ru/soroca",
    );
    await page.getByRole("link", { name: "Briceni" }).click();
    await expect(page).toHaveURL(/\/ru\/briceni$/);
    await page.getByRole("button", { name: /Briceni/ }).click();
    await expect(page).toHaveURL(/\/ru$/);
  });
});

test.describe("контакты", () => {
  test("карточки точек: телефон, меню, карта, отзыв по place_id", async ({
    page,
  }) => {
    await page.goto("/contacte");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Contacte",
    );
    await expect(page.getByText("Lucrăm zilnic 08:30–23:00")).toBeVisible();
    const cards = page.locator("main li");
    await expect(cards).toHaveCount(5);
    await expect(cards.locator("h2")).toHaveText([
      "Apetit Centru",
      "Apetit Soroca Nouă",
      "Apetit Sculeni",
      "Apetit Otaci",
      "Apetit Briceni",
    ]);

    const centru = cards.first();
    await expect(centru).toContainText("Soroca, Str. Independenței 72");
    await expect(
      centru.getByRole("link", { name: "067 578 757" }),
    ).toHaveAttribute("href", "tel:+37367578757");
    await expect(centru.getByRole("link", { name: "Comandă" })).toHaveAttribute(
      "href",
      "/soroca",
    );
    await expect(
      centru.getByRole("link", { name: "Vezi pe hartă" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/place/?q=place_id:ChIJO-lRcwDrzEAR53WfxGtH6CA",
    );
    await expect(
      centru.getByRole("link", { name: "Lasă o recenzie" }),
    ).toHaveAttribute(
      "href",
      "https://search.google.com/local/writereview?placeid=ChIJO-lRcwDrzEAR53WfxGtH6CA",
    );
    const briceni = cards.last();
    await expect(
      briceni.getByRole("link", { name: "Lasă o recenzie" }),
    ).toHaveAttribute(
      "href",
      "https://search.google.com/local/writereview?placeid=ChIJ2YI2WgBzM0cRVzCmzQHNyfQ",
    );
    await expect(
      briceni.getByRole("link", { name: "Vezi pe hartă" }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/place/?q=place_id:ChIJ2YI2WgBzM0cRVzCmzQHNyfQ",
    );

    // «Comandă» — Primary (жёлтая заливка), решение архитектора
    await expect(centru.getByRole("link", { name: "Comandă" })).toHaveClass(
      /btn-primary/,
    );
    // Соцсети — только в подвале, отдельного блока на странице нет
    await expect(
      page.locator("main").getByRole("link", { name: "Instagram" }),
    ).toHaveCount(0);
    await expect(
      page.locator("main").getByRole("link", { name: "TikTok" }),
    ).toHaveCount(0);
    // Форм и карт-виджетов нет
    await expect(page.locator("form, iframe")).toHaveCount(0);
  });

  test("/ru/contacte — по-русски, «Заказать» ведёт на /ru/…", async ({
    page,
  }) => {
    await page.goto("/ru/contacte");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Контакты",
    );
    await expect(
      page.getByText("Работаем ежедневно 08:30–23:00"),
    ).toBeVisible();
    await expect(
      page.locator("main li").nth(3).getByRole("link", { name: "Заказать" }),
    ).toHaveAttribute("href", "/ru/otaci");
  });
});

test.describe("подвал", () => {
  for (const path of [
    "/soroca",
    "/soroca/comanda",
    "/contacte",
    "/confidentialitate",
    "/termeni",
    "/ru/otaci",
  ]) {
    test(`есть на ${path}`, async ({ page }) => {
      await seed(page, { "apetit.cart": JSON.stringify(CART) });
      await page.goto(path);
      const footer = page.locator("footer");
      await expect(footer).toHaveCount(1);
      await expect(footer).toContainText("IDNO 1023607001174");
      const ru = path.startsWith("/ru");
      await expect(
        footer.getByRole("link", { name: ru ? "Контакты" : "Contacte" }),
      ).toHaveAttribute("href", ru ? "/ru/contacte" : "/contacte");
      await expect(
        footer.getByRole("link", { name: ru ? "Условия" : "Termeni" }),
      ).toHaveAttribute("href", ru ? "/ru/termeni" : "/termeni");
      await expect(
        footer.getByRole("link", { name: "Instagram" }),
      ).toHaveAttribute("href", "https://www.instagram.com/apetit.md/");
      await expect(
        footer.getByRole("link", { name: "TikTok" }),
      ).toHaveAttribute("href", "https://www.tiktok.com/@apetit.md");
    });
  }

  test("на экране городов подвала нет", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toHaveCount(0);
    await page.goto("/ru");
    await expect(page.locator("footer")).toHaveCount(0);
  });
});

test.describe("поисковики", () => {
  test("sitemap.xml: все страницы обоих языков с hreflang", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const xml = await res.text();
    for (const path of [
      "",
      "/ru",
      "/soroca",
      "/ru/soroca",
      "/sculeni",
      "/ru/sculeni",
      "/otaci",
      "/ru/otaci",
      "/briceni",
      "/ru/briceni",
      "/contacte",
      "/ru/contacte",
      "/confidentialitate",
      "/ru/confidentialitate",
      "/termeni",
      "/ru/termeni",
    ]) {
      expect(xml).toContain(`<loc>https://apetit.md${path}</loc>`);
    }
    expect(xml).not.toContain("comanda");
    expect(xml).toContain('hreflang="ru"');
    expect(xml).toContain('href="https://apetit.md/ru/otaci"');
  });

  test("robots.txt: sitemap, закрыты admin/api/dev и заказ", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const txt = await res.text();
    expect(txt).toContain("Sitemap: https://apetit.md/sitemap.xml");
    expect(txt).toContain("Disallow: /admin");
    expect(txt).toContain("Disallow: /api/");
    expect(txt).toContain("Disallow: /dev/");
    expect(txt).toContain("Disallow: /ru/soroca/comanda");
  });

  test("Schema.org: Restaurant, BreadcrumbList, Organization", async ({
    page,
  }) => {
    const read = async () =>
      page.locator('script[type="application/ld+json"]').evaluateAll((els) =>
        els.flatMap((el) => {
          const json = JSON.parse(el.textContent ?? "null");
          return Array.isArray(json) ? json : [json];
        }),
      );

    await page.goto("/contacte");
    const contacts = await read();
    const restaurants = contacts.filter((s) => s["@type"] === "Restaurant");
    expect(restaurants).toHaveLength(5);
    expect(restaurants[0]).toMatchObject({
      name: "Apetit Centru",
      telephone: "+37367578757",
      priceRange: "$",
      hasMenu: "https://apetit.md/soroca",
      address: { streetAddress: "Str. Independenței 72" },
      geo: { latitude: 48.156795, longitude: 28.3036351 },
    });
    expect(restaurants[0].openingHoursSpecification[0]).toMatchObject({
      opens: "08:30",
      closes: "23:00",
    });

    await page.goto("/ru/soroca");
    const menu = await read();
    expect(menu.filter((s) => s["@type"] === "Restaurant")).toHaveLength(2);
    const crumbs = menu.find((s) => s["@type"] === "BreadcrumbList");
    expect(crumbs.itemListElement.map((i: { item: string }) => i.item)).toEqual(
      ["https://apetit.md/ru", "https://apetit.md/ru/soroca"],
    );

    await seed(page, { "apetit.cart": JSON.stringify(CART) });
    await page.goto("/soroca/comanda");
    const checkout = await read();
    expect(
      checkout.find((s) => s["@type"] === "BreadcrumbList").itemListElement,
    ).toHaveLength(3);

    // Город уже запомнен — «/» увёл бы в меню; забываем его
    await page.evaluate(() => localStorage.removeItem("apetit.city"));
    await page.goto("/");
    const home = await read();
    expect(home.find((s) => s["@type"] === "Organization")).toMatchObject({
      name: "Apetit",
      sameAs: [
        "https://www.instagram.com/apetit.md/",
        "https://www.tiktok.com/@apetit.md",
      ],
    });
  });

  test("OG-картинки отдаются", async ({ request }) => {
    for (const name of ["apetit", "soroca", "sculeni", "otaci", "briceni"]) {
      const res = await request.get(`/og/${name}.png`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
    }
  });
});

// Safari на iPhone сам искал в тексте «телефоны» и дописывал ссылки tel: в
// готовый HTML — от этого падала гидратация («Hydration failed»). Запрет —
// мета-тег format-detection в корневых метаданных обоих языков.
test.describe("Safari не ищет телефоны в тексте сам", () => {
  const CONTENT = "telephone=no, date=no, address=no, email=no";

  for (const path of [
    "/",
    "/soroca",
    "/contacte",
    "/termeni",
    "/ru",
    "/ru/otaci",
    "/ru/contacte",
  ]) {
    test(`запрет стоит на ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="format-detection"]')).toHaveCount(
        1,
      );
      await expect(
        page.locator('meta[name="format-detection"]'),
      ).toHaveAttribute("content", CONTENT);
    });
  }

  test("IDNO в подвале — текст, а не ссылка, и цифры не идут подряд", async ({
    page,
  }) => {
    await page.goto("/contacte");
    const footer = page.locator("footer");
    // На вид строка прежняя
    await expect(footer).toContainText("IDNO 1023607001174");
    // Ссылки на телефон в подвале нет и быть не должно
    await expect(footer.locator('a[href^="tel:"]')).toHaveCount(0);
    // Вторая защита: тринадцати цифр подряд в разметке подвала нет
    expect(await footer.innerHTML()).not.toContain("1023607001174");
  });

  test("настоящие ссылки tel: на контактах работают", async ({ page }) => {
    await page.goto("/contacte");
    const links = page.locator('main a[href^="tel:"]');
    await expect(links).toHaveCount(5);
    await expect(links.first()).toHaveAttribute("href", "tel:+37367578757");
  });
});
