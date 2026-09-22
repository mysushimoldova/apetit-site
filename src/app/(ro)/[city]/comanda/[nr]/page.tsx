// Подтверждение заказа — /[city]/comanda/[nr]. Тело — src/routes/confirmation.tsx.
import type { Metadata } from "next";
import {
  ConfirmationPage,
  confirmationMetadata,
  type ConfirmationParams,
} from "@/routes/confirmation";

export function generateMetadata(props: ConfirmationParams): Promise<Metadata> {
  return confirmationMetadata("ro", props);
}

export default function Page(props: ConfirmationParams) {
  return <ConfirmationPage locale="ro" {...props} />;
}
