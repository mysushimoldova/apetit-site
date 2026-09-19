// Тексты правовых страниц — /confidentialitate и /termeni. Утверждены
// архитектором 19.09.2026, вставлены дословно; менять только по его слову.
// Реквизиты не пишутся здесь руками: {company}, {idno}, {address}, {email}
// подставляются из src/data/company.ts (fill + companyValues).
import type { Locale } from "@/data/points";

export type LegalBlock =
  /** Подзаголовок + абзацы (политика конфиденциальности) */
  | { kind: "section"; heading: string; paragraphs: string[] }
  /** Нумерованный список (условия) */
  | { kind: "list"; items: string[] };

export interface LegalDoc {
  title: string;
  /** Строка «Ultima actualizare: …» под заголовком */
  updated: string;
  blocks: LegalBlock[];
}

export type LegalSlug = "confidentialitate" | "termeni";

export const legalDocs: Record<LegalSlug, Record<Locale, LegalDoc>> = {
  confidentialitate: {
    ro: {
      title: "Politica de confidențialitate",
      updated: "Ultima actualizare: 19 septembrie 2026",
      blocks: [
        {
          kind: "section",
          heading: "Cine suntem",
          paragraphs: [
            "Site-ul apetit.md este administrat de {company}, IDNO {idno}, adresa juridică: {address}, e-mail: {email}.",
          ],
        },
        {
          kind: "section",
          heading: "Ce date colectăm",
          paragraphs: [
            "Când plasezi o comandă, ne oferi numele, numărul de telefon și, dacă vrei livrare, adresa. Salvăm și conținutul comenzii, punctul ales, data și ora.",
            "Site-ul reține pe dispozitivul tău orașul ales, coșul și datele introduse la ultima comandă — doar ca să nu le introduci din nou. Aceste date rămân pe telefonul sau computerul tău și pot fi șterse din setările browserului.",
          ],
        },
        {
          kind: "section",
          heading: "De ce le folosim",
          paragraphs: [
            "Doar pentru a pregăti și a confirma comanda: casierul punctului te sună la numărul indicat. Nu trimitem mesaje publicitare și nu folosim datele în alte scopuri.",
          ],
        },
        {
          kind: "section",
          heading: "Cine mai vede datele",
          paragraphs: [
            "Comanda ajunge la punctul Apetit ales de tine, prin aplicația Telegram, pe telefonul de serviciu al punctului. Datele sunt stocate pe servere din Uniunea Europeană (Supabase, Frankfurt), iar site-ul este livrat prin Cloudflare. Nu vindem și nu transmitem datele altor companii.",
          ],
        },
        {
          kind: "section",
          heading: "Cât timp le păstrăm",
          paragraphs: [
            "Datele comenzii se păstrează 12 luni, pentru evidență și statistici. După aceea numele, telefonul și adresa se șterg.",
          ],
        },
        {
          kind: "section",
          heading: "Cookie-uri",
          paragraphs: [
            "Site-ul nu folosește cookie-uri de publicitate sau de urmărire. Folosim doar memoria browserului, ca site-ul să funcționeze (oraș, coș).",
          ],
        },
        {
          kind: "section",
          heading: "Drepturile tale",
          paragraphs: [
            "Poți cere să afli ce date avem despre tine, să le corectăm sau să le ștergem — scrie-ne la e-mailul de mai sus sau sună la punctul unde ai comandat. Răspundem în cel mult 30 de zile. Ai dreptul să depui o plângere la Centrul Național pentru Protecția Datelor cu Caracter Personal (datepersonale.md).",
          ],
        },
        {
          kind: "section",
          heading: "Modificări",
          paragraphs: [
            "Putem actualiza această politică. Versiunea curentă este întotdeauna pe această pagină.",
          ],
        },
      ],
    },
    ru: {
      title: "Политика конфиденциальности",
      updated: "Последнее обновление: 19 сентября 2026",
      blocks: [
        {
          kind: "section",
          heading: "Кто мы",
          paragraphs: [
            "Сайт apetit.md принадлежит {company}, IDNO {idno}, юридический адрес: {address}, e-mail: {email}.",
          ],
        },
        {
          kind: "section",
          heading: "Какие данные мы собираем",
          paragraphs: [
            "Когда вы оформляете заказ, вы указываете имя, номер телефона и, если нужна доставка, адрес. Мы также сохраняем состав заказа, выбранный пункт, дату и время.",
            "Сайт запоминает на вашем устройстве выбранный город, корзину и данные последнего заказа — только чтобы не вводить их заново. Эти данные остаются на вашем телефоне или компьютере, их можно удалить в настройках браузера.",
          ],
        },
        {
          kind: "section",
          heading: "Зачем они нужны",
          paragraphs: [
            "Только чтобы приготовить и подтвердить заказ: кассир пункта позвонит вам по указанному номеру. Мы не отправляем рекламу и не используем данные для других целей.",
          ],
        },
        {
          kind: "section",
          heading: "Кто ещё видит данные",
          paragraphs: [
            "Заказ поступает в выбранный вами пункт Apetit через приложение Telegram на рабочий телефон пункта. Данные хранятся на серверах в Европейском союзе (Supabase, Франкфурт), сайт работает через Cloudflare. Мы не продаём и не передаём данные другим компаниям.",
          ],
        },
        {
          kind: "section",
          heading: "Как долго храним",
          paragraphs: [
            "Данные заказа хранятся 12 месяцев — для учёта и статистики. После этого имя, телефон и адрес удаляются.",
          ],
        },
        {
          kind: "section",
          heading: "Cookie",
          paragraphs: [
            "Сайт не использует рекламные и следящие cookie. Мы используем только память браузера, чтобы сайт работал (город, корзина).",
          ],
        },
        {
          kind: "section",
          heading: "Ваши права",
          paragraphs: [
            "Вы можете узнать, какие данные у нас есть о вас, исправить или удалить их — напишите на e-mail выше или позвоните в пункт, где заказывали. Отвечаем в течение 30 дней. Вы вправе подать жалобу в Национальный центр по защите персональных данных (datepersonale.md).",
          ],
        },
        {
          kind: "section",
          heading: "Изменения",
          paragraphs: [
            "Мы можем обновлять эту политику. Актуальная версия всегда на этой странице.",
          ],
        },
      ],
    },
  },
  termeni: {
    ro: {
      title: "Termeni și condiții",
      updated: "Ultima actualizare: 19 septembrie 2026",
      blocks: [
        {
          kind: "list",
          items: [
            "Site-ul apetit.md permite plasarea comenzilor la punctele Apetit. Comanda trimisă de pe site este o cerere: ea devine fermă după ce casierul te sună și o confirmă.",
            "Prețurile sunt în lei moldovenești și pot diferi între puncte. Valabil este prețul afișat pe site pentru punctul ales, la momentul comenzii.",
            "Plata se face la ridicare sau la livrare. Site-ul nu procesează plăți și nu păstrează date bancare.",
            "Livrarea: dacă e disponibilă, în ce zonă și cu ce cost — îți spune casierul la confirmare.",
            "Comenzile se primesc zilnic, 08:30–23:00.",
            "Poți anula comanda sunând la punct, înainte ca ea să fie pregătită.",
            "Dacă ceva nu e în regulă cu comanda, sună la punct sau scrie-ne la {email} — rezolvăm.",
            "Administratorul site-ului: {company}, IDNO {idno}, {address}.",
          ],
        },
      ],
    },
    ru: {
      title: "Условия",
      updated: "Последнее обновление: 19 сентября 2026",
      blocks: [
        {
          kind: "list",
          items: [
            "Сайт apetit.md позволяет оформить заказ в пунктах Apetit. Заказ с сайта — это запрос: он становится окончательным после того, как кассир позвонит и подтвердит его.",
            "Цены указаны в молдавских леях и могут отличаться между пунктами. Действует цена, показанная на сайте для выбранного пункта в момент заказа.",
            "Оплата — при получении или при доставке. Сайт не принимает платежи и не хранит банковские данные.",
            "Доставка: есть ли она, в какой зоне и сколько стоит — скажет кассир при подтверждении.",
            "Заказы принимаются ежедневно, 08:30–23:00.",
            "Заказ можно отменить, позвонив в пункт до того, как он приготовлен.",
            "Если с заказом что-то не так — позвоните в пункт или напишите на {email}, мы решим.",
            "Администратор сайта: {company}, IDNO {idno}, {address}.",
          ],
        },
      ],
    },
  },
};
