// Условия — /ru/termeni. Тело — src/routes/legal.tsx.
import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/routes/legal";

export const metadata: Metadata = legalMetadata("termeni", "ru");

export default function Page() {
  return <LegalPage slug="termeni" locale="ru" />;
}
