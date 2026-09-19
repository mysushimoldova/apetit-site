import { describe, expect, it } from "vitest";
import { parseReceipt, type OrderReceipt } from "./receipt";

const receipt: OrderReceipt = {
  number: 1001,
  pointId: "soroca-centru",
  pointName: "Apetit Centru",
  pointPhone: "067578757",
  city: "soroca",
  lines: [
    {
      name: { ro: "Cola", ru: "Кола" },
      variant: null,
      extra: [],
      cups: [],
      without: [],
      qty: 2,
      unit: 22,
      total: 44,
    },
  ],
  total: 44,
  createdAt: "2026-09-19T09:00:00.000Z",
};

describe("снимок заказа из sessionStorage", () => {
  it("свой номер и город — разобран", () => {
    expect(parseReceipt(JSON.stringify(receipt), 1001, "soroca")).toEqual(
      receipt,
    );
  });

  it("чужой номер, чужой город, мусор, пусто — null", () => {
    const raw = JSON.stringify(receipt);
    expect(parseReceipt(raw, 1002, "soroca")).toBeNull();
    expect(parseReceipt(raw, 1001, "briceni")).toBeNull();
    expect(parseReceipt("{", 1001, "soroca")).toBeNull();
    expect(
      parseReceipt(JSON.stringify({ number: 1001 }), 1001, "soroca"),
    ).toBeNull();
    expect(parseReceipt(null, 1001, "soroca")).toBeNull();
    const evil = { ...receipt, pointPhone: "javascript:alert(1)" };
    expect(parseReceipt(JSON.stringify(evil), 1001, "soroca")).toBeNull();
  });
});
