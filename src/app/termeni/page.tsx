// Условия — /termeni. Тексты — src/i18n/legal.ts.
import type { Metadata } from "next";
import { LegalPage, legalTitle } from "@/components/legal/legal-page";
import { DEFAULT_LOCALE } from "@/i18n/messages";

export const metadata: Metadata = {
  title: legalTitle("termeni", DEFAULT_LOCALE),
};

export default function TermsPage() {
  return <LegalPage slug="termeni" />;
}
