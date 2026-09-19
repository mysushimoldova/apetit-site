import { isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { COMPANY, companyValues } from "@/data/company";
import { fillNodes } from "./fill-nodes";
import { legalDocs } from "./legal";
import { fill, messages } from "./messages";

const allText = (locale: "ro" | "ru") =>
  Object.values(legalDocs)
    .map((d) => JSON.stringify(d[locale]))
    .join(" ");

describe("правовые тексты", () => {
  it("у ro и ru одинаковое устройство: те же разделы и пункты", () => {
    for (const doc of Object.values(legalDocs)) {
      const shape = (l: "ro" | "ru") =>
        doc[l].blocks.map((b) =>
          b.kind === "section" ? b.paragraphs.length : `list:${b.items.length}`,
        );
      expect(shape("ru")).toEqual(shape("ro"));
    }
  });

  it("условия — 8 пунктов, политика — 8 разделов", () => {
    const terms = legalDocs.termeni.ro.blocks[0];
    expect(terms.kind === "list" && terms.items.length).toBe(8);
    expect(legalDocs.confidentialitate.ro.blocks).toHaveLength(8);
  });

  it("реквизиты не вписаны руками — только из company.ts", () => {
    for (const l of ["ro", "ru"] as const) {
      const text = allText(l);
      expect(text).not.toContain(COMPANY.email);
      expect(text).not.toContain(COMPANY.idno);
      expect(text).not.toContain("APETIT STREET");
    }
  });

  it("после подстановки — реквизиты из company.ts, без {…}", () => {
    for (const l of ["ro", "ru"] as const) {
      const filled = fill(allText(l), companyValues(l));
      expect(filled).not.toMatch(/\{\w+\}/);
      expect(filled).toContain(COMPANY.email);
      expect(filled).toContain(COMPANY.idno);
      expect(filled).toContain("S.R.L. „APETIT STREET”");
      expect(filled).toContain(COMPANY.address[l]);
    }
  });
});

describe("строка согласия", () => {
  it("ссылки встают на место {terms} и {privacy}, текст — как утверждён", () => {
    for (const l of ["ro", "ru"] as const) {
      const c = messages[l].checkout.consent;
      const parts = fillNodes(c.text, { terms: c.terms, privacy: c.privacy });
      const text = parts
        .map((p) =>
          isValidElement(p)
            ? (p as ReactElement<{ children: string }>).props.children
            : p,
        )
        .join("");
      expect(text).toBe(
        l === "ro"
          ? "Trimițând comanda, ești de acord cu Termenii și Politica de confidențialitate."
          : "Отправляя заказ, вы соглашаетесь с Условиями и Политикой конфиденциальности.",
      );
    }
  });

  it("неизвестный плейсхолдер остаётся как есть", () => {
    expect(fillNodes("a {x} b", {})).toEqual(["a ", expect.anything(), " b"]);
  });
});
