"use client";
// «Сменить город»: забыть выбор и вернуться на экран городов.
// Кнопка появится в шапке (следующие задачи), здесь только логика.
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { clearCity } from "./city-storage";

export function useChangeCity(): () => void {
  const router = useRouter();
  return useCallback(() => {
    clearCity();
    router.push("/");
  }, [router]);
}
