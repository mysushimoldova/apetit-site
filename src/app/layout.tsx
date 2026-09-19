import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apetit",
  description: "Apetit — kebab, burgeri, gözleme. Comandă online.",
};

export const viewport: Viewport = {
  themeColor: "#FAF7F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={fontVariables}>
      {/* suppressHydrationWarning: расширения браузера дописывают в <body>
          свои атрибуты, и без этого Next ругается на несовпадение HTML. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
