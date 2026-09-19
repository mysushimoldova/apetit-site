import { expect, test, type Page } from "@playwright/test";

// Правовые страницы, подвал меню, строка согласия, защитные заголовки и
// CSP. Профиль — телефон 390px. Сервер — dev (в нём CSP ещё с 'unsafe-eval';
// production-сборку проверяем вручную, см. PROGRESS.md).

const OPEN = "2026-09-19T09:00:00Z"; // 12:00 в Кишинёве

function saveCity(page: Page, slug: string) {
  return page.addInitScript(
    (s) => window.localStorage.setItem("apetit.city", s),
    slug,
  );
}

/** Нарушения CSP страницы — событие securitypolicyviolation. */
async function watchCsp(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      w.__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  const console: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) console.push(m.text());
  });
  return async () => {
    const events = await page.evaluate(
      () => (window as unknown as { __csp: string[] }).__csp,
    );
    return [...events, ...console];
  };
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

test.describe("правовые страницы", () => {
  test("/confidentialitate без выбранного города — ro", async ({ page }) => {
    await page.goto("/confidentialitate");
    await expect(h1(page)).toHaveText("Politica de confidențialitate");
    await expect(h1(page)).toHaveCount(1); // русская версия скрыта
    await expect(
      page.getByRole("heading", { level: 2, name: "Cine suntem" }),
    ).toBeVisible();
    await expect(page.getByText("IDNO 1023607001174").first()).toBeVisible();
    await expect(page).toHaveTitle("Politica de confidențialitate — Apetit");
    // Без города — назад на экран городов, в шапке нет кнопки города
    await expect(
      page.getByRole("link", { name: "Înapoi la meniu" }),
    ).toHaveAttribute("href", "/");
    await expect(
      page.getByRole("button", { name: /Schimbă orașul/ }),
    ).toHaveCount(0);
  });

  test("Otaci → ru сразу; переключатель RO/RU работает", async ({ page }) => {
    await saveCity(page, "otaci");
    await page.goto("/confidentialitate");
    await expect(h1(page)).toHaveText("Политика конфиденциальности");
    await expect(page.locator(".legal-root")).toHaveAttribute(
      "data-lang",
      "ru",
    );
    await expect(
      page.getByRole("link", { name: "Вернуться в меню" }),
    ).toHaveAttribute("href", "/otaci");
    await expect(page.getByRole("button", { name: /Otaci/ })).toBeVisible();

    await page.getByRole("button", { name: "RO", exact: true }).click();
    await expect(h1(page)).toHaveText("Politica de confidențialitate");
    await expect(
      page.getByRole("button", { name: "RO", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "RU", exact: true }).click();
    await expect(h1(page)).toHaveText("Политика конфиденциальности");
  });

  test("/termeni на ro и ru: 8 пунктов", async ({ page }) => {
    await saveCity(page, "soroca");
    await page.goto("/termeni");
    await expect(h1(page)).toHaveText("Termeni și condiții");
    const ro = page.locator('[data-variant="ro"] li');
    await expect(ro).toHaveCount(8);
    await expect(ro.nth(4)).toHaveText(
      "Comenzile se primesc zilnic, 08:30–23:00.",
    );
    await expect(
      page.getByRole("link", { name: "Înapoi la meniu" }),
    ).toHaveAttribute("href", "/soroca");

    await page.getByRole("button", { name: "RU", exact: true }).click();
    await expect(h1(page)).toHaveText("Условия");
    await expect(page.locator('[data-variant="ru"] li')).toHaveCount(8);
  });
});

test.describe("ссылки", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date(OPEN));
    await page.setExtraHTTPHeaders({ "x-apetit-test-now": OPEN });
  });

  test("подвал меню: реквизиты и ссылки", async ({ page }) => {
    await page.goto("/soroca");
    const footer = page.locator("footer");
    await expect(footer).toContainText(
      "© 2026 S.R.L. „APETIT STREET” · IDNO 1023607001174 · or. Soroca, str. Tiraspol 4",
    );
    await expect(
      footer.getByRole("link", { name: "dddpaskary@gmail.com" }),
    ).toHaveAttribute("href", "mailto:dddpaskary@gmail.com");

    await footer.getByRole("link", { name: "Termeni" }).click();
    await expect(page).toHaveURL(/\/termeni$/);
    await expect(h1(page)).toHaveText("Termeni și condiții");

    await page.goto("/soroca");
    await page
      .locator("footer")
      .getByRole("link", { name: "Politica de confidențialitate" })
      .click();
    await expect(page).toHaveURL(/\/confidentialitate$/);
    await expect(h1(page)).toHaveText("Politica de confidențialitate");
  });

  test("подвал Otaci — по-русски; переход сохраняет язык", async ({ page }) => {
    await page.goto("/otaci");
    const footer = page.locator("footer");
    await expect(footer).toContainText("г. Сорока, ул. Тирасполь 4");
    await footer.getByRole("link", { name: "Условия" }).click();
    await expect(page).toHaveURL(/\/termeni$/);
    await expect(h1(page)).toHaveText("Условия");
  });

  test("строка согласия под кнопкой заказа", async ({ page }) => {
    // С пустой корзиной оформление уводит в меню — кладём одно блюдо
    await page.addInitScript(() =>
      window.localStorage.setItem(
        "apetit.cart",
        JSON.stringify({
          state: {
            city: "soroca",
            lines: [
              {
                productSlug: "cola",
                variantId: null,
                addonIds: [],
                removedIds: [],
                qty: 1,
              },
            ],
          },
          version: 1,
        }),
      ),
    );
    await page.goto("/soroca/comanda");
    const note = page.locator(".consent-note");
    await expect(note).toHaveText(
      "Trimițând comanda, ești de acord cu Termenii și Politica de confidențialitate.",
    );
    await expect(note.getByRole("link", { name: "Termenii" })).toHaveAttribute(
      "href",
      "/termeni",
    );
    // Открывается в новой вкладке — форма не теряется
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      note.getByRole("link", { name: "Politica de confidențialitate" }).click(),
    ]);
    await expect(popup).toHaveURL(/\/confidentialitate$/);
    await expect(h1(popup)).toHaveText("Politica de confidențialitate");
    await expect(page).toHaveURL(/\/soroca\/comanda$/);
  });

  test("строка согласия на ru (Otaci)", async ({ page }) => {
    await page.goto("/otaci/comanda");
    await expect(page.locator(".consent-note")).toHaveText(
      "Отправляя заказ, вы соглашаетесь с Условиями и Политикой конфиденциальности.",
    );
  });
});

test.describe("защитные заголовки и CSP", () => {
  for (const path of [
    "/",
    "/soroca",
    "/soroca/comanda",
    "/confidentialitate",
  ]) {
    test(`заголовки на ${path}`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      const h = res.headers();
      expect(h["strict-transport-security"]).toBe(
        "max-age=63072000; includeSubDomains; preload",
      );
      expect(h["x-content-type-options"]).toBe("nosniff");
      expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
      expect(h["x-frame-options"]).toBe("DENY");
      expect(h["permissions-policy"]).toBe(
        "geolocation=(self), camera=(), microphone=(), payment=()",
      );
      expect(h["content-security-policy"]).toContain("default-src 'self'");
      expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
      expect(h["x-powered-by"]).toBeUndefined();
    });
  }

  test("заказ проходит с CSP, нарушений нет", async ({ page }) => {
    await page.clock.setFixedTime(new Date(OPEN));
    await page.setExtraHTTPHeaders({ "x-apetit-test-now": OPEN });
    const violations = await watchCsp(page);

    await page.goto("/");
    await page.getByRole("link", { name: "Sculeni" }).click();
    await expect(page).toHaveURL(/\/sculeni$/);
    await page.waitForFunction(() => document.readyState === "complete");
    await page.getByRole("button", { name: "Adaugă: Kebab Cheese" }).click();
    await page.locator(".cart-bar").getByRole("button").click();
    await page
      .getByRole("dialog", { name: "Coș" })
      .getByRole("link", { name: "Comandă" })
      .click();
    await expect(page).toHaveURL(/\/sculeni\/comanda$/);
    await page.getByLabel("Nume").fill("Ion Popescu");
    const digits = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
    await page.getByLabel("Telefon").pressSequentially(`069${digits}`);
    await page.getByRole("button", { name: "Trimite comanda" }).click();
    await expect(page).toHaveURL(/\/sculeni\/comanda\/\d+$/);
    await expect(page.getByText("Te sunăm în câteva minute")).toBeVisible();

    // Шрифты загрузились (свои, с нашего сервера), ни один не заблокирован
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((f) => f.status);
    });
    expect(fonts).toContain("loaded");
    expect(fonts).not.toContain("error");
    expect(await violations()).toEqual([]);
  });
});
