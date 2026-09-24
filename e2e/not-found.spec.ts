import { expect, test, type Page } from "@playwright/test";

// Страница «такого адреса нет»: тексты на двух языках и куда ведёт кнопка.
// Профиль — телефон 390px.

function saveCity(page: Page, slug: string) {
  return page.addInitScript(
    (s) => window.localStorage.setItem("apetit.city", s),
    slug,
  );
}

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

test.describe("404", () => {
  test("румынский адрес — ro-тексты, кнопка на выбор города", async ({
    page,
  }) => {
    const response = await page.goto("/nu-exista-asa-pagina");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(h1(page)).toHaveText("Pagina nu există");
    await expect(
      page.getByText("Poate link-ul e vechi sau adresa e scrisă greșit."),
    ).toBeVisible();
    const back = page.getByRole("link", { name: "Înapoi la meniu" });
    await expect(back).toHaveAttribute("href", "/");
  });

  test("русский адрес — ru-тексты и lang=ru", async ({ page }) => {
    const response = await page.goto("/ru/net-takoy-stranicy");
    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(h1(page)).toHaveText("Страница не найдена");
    await expect(
      page.getByText("Возможно, ссылка устарела или в адресе опечатка."),
    ).toBeVisible();
    const back = page.getByRole("link", { name: "Вернуться в меню" });
    await expect(back).toHaveAttribute("href", "/ru");
  });

  test("город сохранён — кнопка ведёт в меню точки", async ({ page }) => {
    await saveCity(page, "soroca");
    await page.goto("/nu-exista-asa-pagina");
    await expect(
      page.getByRole("link", { name: "Înapoi la meniu" }),
    ).toHaveAttribute("href", "/soroca");

    await page.goto("/ru/net-takoy-stranicy");
    await expect(
      page.getByRole("link", { name: "Вернуться в меню" }),
    ).toHaveAttribute("href", "/ru/soroca");
  });
});
