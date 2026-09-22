// Румынский — без префикса в адресе (группа маршрутов (ro) не меняет адрес).
// Свой корневой layout на язык: <html lang="ro">. Общее — src/routes/root.tsx.
import type { Metadata } from "next";
import { RootHtml, rootMetadata } from "@/routes/root";
import "@/app/globals.css";

export { viewport } from "@/routes/root";

export const metadata: Metadata = rootMetadata();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootHtml locale="ro">{children}</RootHtml>;
}
