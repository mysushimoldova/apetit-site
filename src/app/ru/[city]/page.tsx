// Меню города — /ru/[city]. Тело — src/routes/city-menu.tsx.
import type { Metadata } from "next";
import {
  CityMenuPage,
  cityMenuMetadata,
  cityParams,
  type CityParams,
} from "@/routes/city-menu";

export function generateStaticParams() {
  return cityParams();
}

// Любой другой slug → 404, а не попытка отрендерить.
export const dynamicParams = false;

export function generateMetadata(props: CityParams): Promise<Metadata> {
  return cityMenuMetadata("ru", props);
}

export default function Page(props: CityParams) {
  return <CityMenuPage locale="ru" {...props} />;
}
