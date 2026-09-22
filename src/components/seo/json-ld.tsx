// Разметка Schema.org для поисковиков: <script type="application/ld+json">.
// Не исполняется браузером, поэтому CSP его не касается.
import { serializeJsonLd, type JsonLd as JsonLdData } from "@/lib/schema-org";

export function JsonLd({ data }: { data: JsonLdData | JsonLdData[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
