// Контакты — /ru/contacte. Тело — src/routes/contacts.tsx.
import type { Metadata } from "next";
import { ContactsPage, contactsMetadata } from "@/routes/contacts";

export const metadata: Metadata = contactsMetadata("ru");

export default function Page() {
  return <ContactsPage locale="ru" />;
}
