// Оформление заказа — /[city]/comanda. Тело — src/routes/checkout.tsx.
import type { Metadata } from "next";
import { CheckoutPage, checkoutMetadata } from "@/routes/checkout";
import { cityParams, type CityParams } from "@/routes/city-menu";

export function generateStaticParams() {
  return cityParams();
}

export const dynamicParams = false;

export function generateMetadata(props: CityParams): Promise<Metadata> {
  return checkoutMetadata("ro", props);
}

export default function Page(props: CityParams) {
  return <CheckoutPage locale="ro" {...props} />;
}
