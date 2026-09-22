// Условия — /termeni. Тело — src/routes/legal.tsx.
import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/routes/legal";

export const metadata: Metadata = legalMetadata("termeni", "ro");

export default function Page() {
  return <LegalPage slug="termeni" locale="ro" />;
}
