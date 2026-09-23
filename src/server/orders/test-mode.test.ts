// Кто имеет право пометить заказ тестовым (orders.is_test, миграция 0005).
// Главное, что здесь проверяется: в боевой среде пометка невозможна ни при
// каком заголовке — иначе чужой запрос мог бы спрятать настоящий заказ от
// точки и от владельца.
import { afterEach, describe, expect, it, vi } from "vitest";
import { isTestOrderRequest, TEST_HEADER } from "./test-mode";

const SECRET = "secret-of-this-run";

afterEach(() => {
  vi.unstubAllEnvs();
});

function env(over: {
  node?: string;
  e2e?: string | undefined;
  secret?: string | undefined;
}) {
  vi.stubEnv("NODE_ENV", over.node ?? "development");
  vi.stubEnv("APETIT_E2E", over.e2e);
  vi.stubEnv("APETIT_TEST_SECRET", over.secret);
}

describe("isTestOrderRequest", () => {
  it("заголовок совпал с секретом прогона — заказ тестовый", () => {
    env({ e2e: "1", secret: SECRET });
    expect(isTestOrderRequest(SECRET)).toBe(true);
  });

  it("в боевой сборке — никогда, даже с правильным секретом", () => {
    env({ node: "production", e2e: "1", secret: SECRET });
    expect(isTestOrderRequest(SECRET)).toBe(false);
  });

  it("без APETIT_E2E — никогда (обычный dev-сервер хозяина)", () => {
    env({ e2e: undefined, secret: SECRET });
    expect(isTestOrderRequest(SECRET)).toBe(false);
  });

  it("секрет не задан — никогда (иначе сошёлся бы пустой заголовок)", () => {
    env({ e2e: "1", secret: undefined });
    expect(isTestOrderRequest("")).toBe(false);
    expect(isTestOrderRequest(null)).toBe(false);
    expect(isTestOrderRequest("что угодно")).toBe(false);
  });

  it("чужой или отсутствующий заголовок — обычный заказ", () => {
    env({ e2e: "1", secret: SECRET });
    expect(isTestOrderRequest("не тот секрет")).toBe(false);
    expect(isTestOrderRequest(null)).toBe(false);
    expect(isTestOrderRequest(`${SECRET} `)).toBe(false);
  });

  it("имя заголовка — в нижнем регистре (Headers отдаёт такие)", () => {
    expect(TEST_HEADER).toBe(TEST_HEADER.toLowerCase());
  });
});
