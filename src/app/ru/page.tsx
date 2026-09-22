// Экран городов по-русски — /ru. Тело — src/routes/home.tsx.
import type { Metadata } from "next";
import { HomeScreen, homeMetadata } from "@/routes/home";

export const metadata: Metadata = homeMetadata("ru");

export default function Home() {
  return <HomeScreen locale="ru" />;
}
