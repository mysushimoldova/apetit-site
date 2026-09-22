import { describe, expect, it } from "vitest";
import {
  fieldError,
  normalizeAddress,
  normalizeName,
  normalizeOrderPhone,
} from "./fields";
import { OrderInputSchema } from "./schema";

describe("правила полей заказа — без zod, те же что на сервере", () => {
  it("имя приводится к виду, который уйдёт в базу", () => {
    expect(normalizeName("  Ion   Popescu ")).toBe("Ion Popescu");
    expect(normalizeName("Ștefan-Ion O’Neil")).toBe("Ștefan-Ion O’Neil");
    expect(normalizeName("I")).toBeNull();
    expect(normalizeName("a".repeat(41))).toBeNull();
    expect(normalizeName("a".repeat(201))).toBeNull();
    expect(normalizeName("123")).toBeNull();
    expect(normalizeName(`Ion${String.fromCharCode(0)}`)).toBeNull();
  });

  it("адрес: пустой можно, длинный нельзя, невидимые символы нельзя", () => {
    expect(normalizeAddress("")).toBe("");
    expect(normalizeAddress(" str.  Ștefan 12 ")).toBe("str. Ștefan 12");
    expect(normalizeAddress("a".repeat(121))).toBeNull();
    expect(normalizeAddress("a".repeat(501))).toBeNull();
    expect(normalizeAddress(`a${String.fromCharCode(0x202e)}b`)).toBeNull();
  });

  it("телефон: формат Молдовы, длинный мусор отбрасывается", () => {
    expect(normalizeOrderPhone("067 578 757")).toBe("+37367578757");
    expect(normalizeOrderPhone("+373 67 578 757")).toBe("+37367578757");
    expect(normalizeOrderPhone("12345")).toBeNull();
    expect(normalizeOrderPhone("0".repeat(33))).toBeNull();
  });

  /**
   * Главное свойство разделения: форма (эти функции) и сервер (zod-схема)
   * должны выносить одинаковый приговор. Иначе человек увидит зелёное поле,
   * а сервер откажет — или наоборот.
   */
  it("форма и сервер отвечают одинаково на одних и тех же значениях", () => {
    const base = {
      pointId: "soroca-centru",
      lines: [
        {
          productSlug: "cola",
          variantId: null,
          addonIds: [],
          removedIds: [],
          qty: 1,
        },
      ],
      name: "Ion",
      phone: "067578757",
      address: "",
      website: "",
      lang: "ro" as const,
    };
    const cases: { field: "name" | "phone" | "address"; value: string }[] = [
      { field: "name", value: "Ion" },
      { field: "name", value: "  Ion   Popescu " },
      { field: "name", value: "Ștefan-Ion O’Neil" },
      { field: "name", value: "I" },
      { field: "name", value: "" },
      { field: "name", value: "123" },
      { field: "name", value: "<script>" },
      { field: "name", value: "a".repeat(41) },
      { field: "name", value: "a".repeat(201) },
      { field: "name", value: `Ion${String.fromCharCode(0x200b)}` },
      { field: "phone", value: "067578757" },
      { field: "phone", value: "+373 67 578 757" },
      { field: "phone", value: "00373 67 578 757" },
      { field: "phone", value: "012345678" },
      { field: "phone", value: "" },
      { field: "phone", value: "abc" },
      { field: "address", value: "" },
      { field: "address", value: "str. Ștefan cel Mare 12, ap. 3" },
      { field: "address", value: "a".repeat(120) },
      { field: "address", value: "a".repeat(121) },
      { field: "address", value: `a${String.fromCharCode(0x202e)}b` },
    ];
    for (const { field, value } of cases) {
      const form = fieldError(field, value) === null;
      const server = OrderInputSchema.safeParse({
        ...base,
        [field]: value,
      }).success;
      expect(server, `${field}: ${JSON.stringify(value)}`).toBe(form);
    }
  });

  it("сервер записывает то же значение, что показала форма", () => {
    const parsed = OrderInputSchema.safeParse({
      pointId: "soroca-centru",
      lines: [
        {
          productSlug: "cola",
          variantId: null,
          addonIds: [],
          removedIds: [],
          qty: 1,
        },
      ],
      name: "  Ion   Popescu ",
      phone: "067 578 757",
      address: " str.  Ștefan 12 ",
      website: "",
      lang: "ro",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      name: normalizeName("  Ion   Popescu "),
      phone: normalizeOrderPhone("067 578 757"),
      address: normalizeAddress(" str.  Ștefan 12 "),
    });
  });
});
