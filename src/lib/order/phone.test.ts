import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, maskPhoneInput, normalizePhone } from "./phone";

describe("телефон Молдовы", () => {
  it.each([
    ["067578757", "+37367578757"],
    ["067 578 757", "+37367578757"],
    ["(067) 57-87-57", "+37367578757"],
    ["+37367578757", "+37367578757"],
    ["+373 67 578 757", "+37367578757"],
    ["37367578757", "+37367578757"],
    ["0037367578757", "+37367578757"],
    ["023022222", "+37323022222"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    "",
    "67578757", // без 0
    "06757875", // мало цифр
    "0675787571", // много цифр
    "+3736757875",
    "+40721234567", // Румыния
    "001234567", // после 0 не может идти 0
    "011234567",
    "067a78757",
    "+373 067 578 757",
  ])("плохой номер %j → null", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("маска при вводе: 0XX XXX XXX и +373 XX XXX XXX", () => {
    expect(maskPhoneInput("0")).toBe("0");
    expect(maskPhoneInput("0675")).toBe("067 5");
    expect(maskPhoneInput("067578757")).toBe("067 578 757");
    expect(maskPhoneInput("0675787579999")).toBe("067 578 757");
    expect(maskPhoneInput("+373")).toBe("+373");
    expect(maskPhoneInput("+37367578757")).toBe("+373 67 578 757");
    expect(maskPhoneInput("+373 67 57")).toBe("+373 67 57");
    expect(maskPhoneInput("abc")).toBe("");
  });

  it("номер точки для показа: 067 578 757", () => {
    expect(formatPhoneDisplay("067578757")).toBe("067 578 757");
  });
});
