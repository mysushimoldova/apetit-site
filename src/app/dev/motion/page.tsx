// Панель настройки движения — только для разработки. В боевой сборке
// страницы нет: notFound() при сборке даёт обычный 404
// (проверено в e2e-prod/dev-routes.spec.ts).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MotionPanel } from "@/components/dev/motion-panel";
import { motionConfig } from "@/config/motion";

export const metadata: Metadata = {
  title: "Движение — настройка",
  robots: { index: false, follow: false },
};

export default function DevMotionPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <MotionPanel saved={motionConfig.background} />;
}
