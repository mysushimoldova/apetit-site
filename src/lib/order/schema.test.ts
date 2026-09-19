import { describe, expect, it } from "vitest";
import { OrderInputSchema, fieldError } from "./schema";

const valid = {
  pointId: "soroca-centru",
  lines: [
    {
      productSlug: "cola",
      variantId: null,
      addonIds: [],
      removedIds: [],
      qty: 2,
    },
  ],
  name: "  Ion   Popescu ",
  phone: "067 578 757",
  address: "",
  website: "",
};

describe("вход заказа (zod)", () => {
  it("нормализует имя и телефон, адрес необязателен", () => {
    const r = OrderInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      name: "Ion Popescu",
      phone: "+37367578757",
      address: "",
    });
  });

  it("суммы с клиента не принимаются: лишние поля — отказ", () => {
    expect(OrderInputSchema.safeParse({ ...valid, total: 1 }).success).toBe(
      false,
    );
  });

  it("цена внутри позиции отбрасывается, а не используется", () => {
    const r = OrderInputSchema.safeParse({
      ...valid,
      lines: [{ ...valid.lines[0], price: 1 }],
    });
    expect(r.success).toBe(true);
    expect(r.data?.lines[0]).not.toHaveProperty("price");
  });

  it("имя: 2–40 символов, буквы (ro/ru), дефис, апостроф", () => {
    expect(fieldError("name", "Ана")).toBeNull();
    expect(fieldError("name", "Ștefan-Ion O'Neil")).toBeNull();
    expect(fieldError("name", "I")).toBe("name");
    expect(fieldError("name", "a".repeat(41))).toBe("name");
    expect(fieldError("name", "<script>")).toBe("name");
    expect(fieldError("name", "Ion" + String.fromCharCode(0))).toBe("name");
    expect(fieldError("name", "123")).toBe("name");
  });

  it("телефон — формат Молдовы", () => {
    expect(fieldError("phone", "+373 67 578 757")).toBeNull();
    expect(fieldError("phone", "12345")).toBe("phone");
    expect(fieldError("phone", "")).toBe("phone");
  });

  it("адрес — до 120 символов, без управляющих символов", () => {
    expect(fieldError("address", "")).toBeNull();
    expect(fieldError("address", "str. Ștefan cel Mare 12, ap. 3")).toBeNull();
    expect(fieldError("address", "a".repeat(121))).toBe("address");
    expect(fieldError("address", "a" + String.fromCharCode(0x202e) + "b")).toBe(
      "address",
    );
  });

  it("позиции: 1–50, qty 1–99", () => {
    expect(OrderInputSchema.safeParse({ ...valid, lines: [] }).success).toBe(
      false,
    );
    const many = Array.from({ length: 51 }, () => valid.lines[0]);
    expect(OrderInputSchema.safeParse({ ...valid, lines: many }).success).toBe(
      false,
    );
    expect(
      OrderInputSchema.safeParse({
        ...valid,
        lines: [{ ...valid.lines[0], qty: 100 }],
      }).success,
    ).toBe(false);
  });

  it("мусор вместо объекта — отказ без исключений", () => {
    for (const bad of [null, "x", 1, [], { pointId: "../../etc" }]) {
      expect(OrderInputSchema.safeParse(bad).success).toBe(false);
    }
  });
});
