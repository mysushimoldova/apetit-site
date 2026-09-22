// Экран городов — /. Тело — src/routes/home.tsx.
import type { Metadata } from "next";
import { HomeScreen, homeMetadata } from "@/routes/home";

export const metadata: Metadata = homeMetadata("ro");

export default function Home() {
  return <HomeScreen locale="ro" />;
}
