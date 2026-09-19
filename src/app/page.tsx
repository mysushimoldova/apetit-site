// Временная главная (этап 5): проверка, что шрифты и символы работают.
// Заменяется экраном городов на следующем этапе.
export default function Home() {
  return (
    <main className="page flex min-h-dvh flex-col justify-center gap-6 py-16">
      <h1 className="font-display text-city uppercase">APETIT</h1>

      <p className="font-ui text-title">
        Soroca · Sculeni · Florești · Otaci · Briceni
      </p>

      <p className="font-body text-body text-charcoal">
        Verificare fonturi: ș ț ă â î — Ș Ț Ă Â Î
      </p>

      <p className="font-body text-meta font-medium text-smoke">
        Проверка кириллицы: Сорока, Флорешты, Отачь, Бричаны
      </p>
    </main>
  );
}
