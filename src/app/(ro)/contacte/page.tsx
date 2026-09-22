// Контакты — /contacte. Тело — src/routes/contacts.tsx.
import type { Metadata } from "next";
import { ContactsPage, contactsMetadata } from "@/routes/contacts";

export const metadata: Metadata = contactsMetadata("ro");

export default function Page() {
  return <ContactsPage locale="ro" />;
}
