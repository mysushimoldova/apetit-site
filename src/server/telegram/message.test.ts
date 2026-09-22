import { describe, expect, it } from "vitest";
import type { ReceiptLine } from "@/lib/order/receipt";
import {
  acceptCallbackData,
  acceptedMessage,
  escapeHtml,
  formatPhone,
  formatTime,
  orderMessage,
} from "./message";

const kebab: ReceiptLine = {
  name: { ro: "Kebab Cheese", ru: "Кебаб с сыром" },
  variant: { ro: "XXL", ru: "XXL" },
  extra: [{ ro: "Sos de usturoi", ru: "Чесночный соус" }],
  cups: [{ ro: "Ketchup", ru: "Кетчуп" }],
  without: [{ ro: "ceapă", ru: "лук" }],
  qty: 2,
  unit: 99,
  total: 198,
};
const cola: ReceiptLine = {
  name: { ro: "Coca-Cola", ru: "Кока-кола" },
  variant: null,
  extra: [],
  cups: [],
  without: [],
  qty: 1,
  unit: 22,
  total: 22,
};

const order = {
  number: 1042,
  pointName: "Apetit Soroca Nouă",
  name: "Ion",
  phone: "+37368123456",
  address: "str. Ștefan cel Mare 12",
  lines: [kebab, cola],
  total: 220,
  createdAt: "2026-09-19T15:42:00Z", // 18:42 в Кишинёве (лето, UTC+3)
};

describe("orderMessage — текст заказа для Telegram (HTML)", () => {
  it("ro: номер жирным, точка, контакты, состав с вариантом/Extra/Sos aparte/Fără, сумма, время", () => {
    expect(orderMessage(order, "ro")).toBe(
      [
        "🔴 <b>COMANDĂ NOUĂ #1042</b>",
        "Apetit Soroca Nouă",
        "",
        "👤 Ion",
        "📞 +373 68 123 456",
        "📍 str. Ștefan cel Mare 12",
        "",
        "2 × Kebab Cheese (XXL) — 198 lei",
        "    Extra: Sos de usturoi · Sos aparte: Ketchup · Fără: ceapă",
        "1 × Coca-Cola — 22 lei",
        "",
        "💰 <b>TOTAL: 220 lei</b>",
        "🕐 18:42",
      ].join("\n"),
    );
  });

  it("ru (Otaci): те же данные по-русски", () => {
    const text = orderMessage(order, "ru");
    expect(text).toContain("🔴 <b>НОВЫЙ ЗАКАЗ #1042</b>");
    expect(text).toContain("2 × Кебаб с сыром (XXL) — 198 лей");
    expect(text).toContain(
      "Добавки: Чесночный соус · Соус отдельно: Кетчуп · Без: лук",
    );
    expect(text).toContain("💰 <b>ИТОГО: 220 лей</b>");
  });

  it("без адреса — строки 📍 нет", () => {
    const text = orderMessage({ ...order, address: null }, "ro");
    expect(text).not.toContain("📍");
    expect(text.split("\n")[5]).toBe("");
  });

  it("опасные символы в имени и адресе экранируются — разметку не сломать", () => {
    const text = orderMessage(
      {
        ...order,
        name: "<b>Ion</b> & Co",
        address: "str. <script>alert(1)</script>",
      },
      "ro",
    );
    expect(text).toContain("👤 &lt;b&gt;Ion&lt;/b&gt; &amp; Co");
    expect(text).toContain("📍 str. &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(text).not.toContain("<script>");
    // Наша собственная разметка на месте
    expect(text).toContain("<b>COMANDĂ NOUĂ #1042</b>");
  });

  it("escapeHtml: только &, <, > — кавычки и остальное как есть", () => {
    expect(escapeHtml(`a<b>&"c'`)).toBe(`a&lt;b&gt;&amp;"c'`);
  });

  it("acceptedMessage: заголовок «🟢 PRELUATĂ · 18:45 — #1042», остальное то же, без строки внизу", () => {
    const text = acceptedMessage(order, "ro", new Date("2026-09-19T15:45:00Z"));
    const [header, ...rest] = text.split("\n");
    expect(header).toBe("🟢 <b>PRELUATĂ · 18:45 — #1042</b>");
    expect(rest.join("\n")).toBe(
      orderMessage(order, "ro").split("\n").slice(1).join("\n"),
    );
    expect(text).not.toContain("Primit la");
    expect(
      acceptedMessage(order, "ru", new Date("2026-09-19T15:45:00Z")).split(
        "\n",
      )[0],
    ).toBe("🟢 <b>ПРИНЯТ · 18:45 — #1042</b>");
  });

  it("время, телефон, callback_data", () => {
    // Зима: UTC+2
    expect(formatTime(new Date("2026-12-19T16:42:00Z"))).toBe("18:42");
    expect(formatPhone("+37368123456")).toBe("+373 68 123 456");
    expect(formatPhone("+4912345")).toBe("+4912345");
    const data = acceptCallbackData("00000000-0000-4000-8000-000000001042");
    expect(data).toBe("accept:00000000-0000-4000-8000-000000001042");
    expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(64);
  });
});
