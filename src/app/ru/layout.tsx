// Русский — все страницы с префиксом /ru (SPEC §7).
// Свой корневой layout на язык: <html lang="ru">. Общее — src/routes/root.tsx.
import type { Metadata } from "next";
import { RootHtml, rootMetadata } from "@/routes/root";
import "@/app/globals.css";

export { viewport } from "@/routes/root";

export const metadata: Metadata = rootMetadata();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml locale="ru">{children}</RootHtml>;
}
