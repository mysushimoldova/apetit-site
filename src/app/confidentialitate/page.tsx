// Политика конфиденциальности — /confidentialitate. Тексты — src/i18n/legal.ts.
import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/legal/legal-page";
import { DEFAULT_LOCALE } from "@/i18n/messages";

export const metadata: Metadata = {
  title: legalTitle("confidentialitate", DEFAULT_LOCALE),
};

export default function PrivacyPage() {
  return <LegalPage slug="confidentialitate" />;
}
