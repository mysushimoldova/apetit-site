import { describe, expect, it } from "vitest";
import { messages } from "@/i18n/messages";
import type { SubmitResult } from "@/server/orders/submit";
import { SERVER_ERROR_TEXT } from "./server-error";

type FailCode = Extract<SubmitResult, { ok: false }>["code"];

// Все коды отказа сервера. Record требует полноты: появится новый код —
// здесь ошибка сборки, а не молчаливое «Заказ не принят» на экране.
const ALL_CODES: Record<FailCode, true> = {
  invalid: true,
  closed: true,
  unavailable: true,
  point_paused: true,
  rate_limited: true,
  db_error: true,
  rejected: true,
};

/** Коды со своим поведением в форме — у них не одно только сообщение. */
const HANDLED_IN_FORM: FailCode[] = ["invalid", "closed", "unavailable"];

describe("отказы сервера на экране оформления", () => {
  it("у каждого кода отказа есть свой разбор в форме", () => {
    for (const code of Object.keys(ALL_CODES) as FailCode[]) {
      if (HANDLED_IN_FORM.includes(code)) continue;
      expect(SERVER_ERROR_TEXT, code).toHaveProperty(code);
    }
  });

  it("у каждого сообщения есть текст на обоих языках", () => {
    for (const key of Object.values(SERVER_ERROR_TEXT)) {
      for (const locale of ["ro", "ru"] as const) {
        expect(
          messages[locale].checkout.errors[key],
          `${locale}: ${key}`,
        ).toBeTruthy();
      }
    }
  });

  it("«база не ответила» — не то же самое, что «заказ не принят»", () => {
    for (const locale of ["ro", "ru"] as const) {
      const errors = messages[locale].checkout.errors;
      expect(errors.dbError).not.toBe(errors.rejected);
    }
  });
});
