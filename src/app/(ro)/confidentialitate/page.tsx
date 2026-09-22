// Политика конфиденциальности — /confidentialitate. Тело — src/routes/legal.tsx.
import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/routes/legal";

export const metadata: Metadata = legalMetadata("confidentialitate", "ro");

export default function Page() {
  return <LegalPage slug="confidentialitate" locale="ro" />;
}
