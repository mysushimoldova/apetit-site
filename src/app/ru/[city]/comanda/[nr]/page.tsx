// Подтверждение заказа — /ru/[city]/comanda/[nr]. Тело — src/routes/confirmation.tsx.
import type { Metadata } from "next";
import {
  ConfirmationPage,
  confirmationMetadata,
  type ConfirmationParams,
} from "@/routes/confirmation";

export function generateMetadata(props: ConfirmationParams): Promise<Metadata> {
  return confirmationMetadata("ru", props);
}

export default function Page(props: ConfirmationParams) {
  return <ConfirmationPage locale="ru" {...props} />;
}
