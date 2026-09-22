# Telefonul punctului — comenzi din apetit.md prin Telegram

Instrucțiune pentru casier. Durează 5 minute, se face o singură dată.

## 1. Conectează botul

1. Deschide Telegram pe telefonul de lucru al punctului.
2. Caută **@apetit_comenzi_bot** (sau deschide t.me/apetit_comenzi_bot) și apasă **Start**.
3. Trimite mesajul: `/start COD` — codul îl primești de la administrator
   (8 semne, de exemplu `/start AB2CD3EF`).
4. Botul răspunde: **„Punct conectat: Apetit …”**. Gata — comenzile vor veni în
   acest chat.

Dacă răspunde „Cod greșit” — verifică codul (litere mari, fără spații).
Dacă răspunde „Punctul este deja conectat la alt chat” — codul a fost folosit
pe alt telefon; cere administratorului să reconecteze.

## 2. Sunet tare pentru acest chat (obligatoriu)

Comenzile trebuie auzite în bucătărie. Setează sunetul **pentru chatul cu
botul**, nu pentru tot Telegram-ul.

**Android**
1. Deschide chatul cu botul → apasă pe numele botului sus.
2. **Notificări** → pornește **Personalizează** (Customize).
3. **Sunet** → alege cel mai tare (de ex. „Alarm”/„Sirenă”), **Vibrație → Pornit**,
   **Prioritate/Importanță → Urgent** (dacă există).
4. Setări telefon → **Aplicații → Telegram → Notificări** → toate pornite;
   **Baterie → Nerestricționat** (altfel telefonul „adoarme” aplicația).
5. Setări → **Sunet → Nu deranja** → excepții → permite Telegram (sau nu folosi
   „Nu deranja” la serviciu).

**iPhone**
1. Deschide chatul cu botul → apasă pe numele botului sus.
2. **Notificări** → **Personalizează** → **Sunet** → alege un sunet lung și tare.
3. Setări iPhone → **Notificări → Telegram** → Permite notificări, **Sunete**
   pornit, Bannere → **Persistente**, **Notificări sensibile la timp** pornit.
4. Setări → **Focalizare** (Nu deranja / La serviciu) → adaugă Telegram la
   aplicațiile permise.
5. **Comutatorul lateral al telefonului să nu fie pe „silențios”** și volumul
   la maxim — altfel Telegram nu sună.

Denumirile pot diferi puțin în funcție de versiune; caută „Notificări” în chatul
botului.

## 3. Ce faci când vine o comandă

Mesajul arată așa: `🔴 COMANDĂ NOUĂ #1042`, numele clientului, telefonul,
adresa (dacă e livrare), produsele, TOTAL, ora.

1. **Sună clientul** — apasă pe numărul din mesaj, telefonul formează numărul.
   Confirmă comanda și timpul.
2. **Apasă butonul „✅ Am preluat”** sub mesaj. Titlul devine
   `🟢 PRELUATĂ · 18:45 — #1042` și butonul dispare. Comanda rămâne în chat —
   e istoricul vostru.
3. Pregătește comanda.

Apasă „Am preluat” **doar după ce ai văzut comanda** — butonul înseamnă
„am preluat-o în lucru”.

## 4. Ce înseamnă ⏰ și ⚠️

Botul nu vede dacă ai citit mesajul — vede doar butonul. De aceea, dacă nu apeși
„Am preluat”:

- la fiecare **2 minute** vine `⏰ Comanda #1042 așteaptă — X minute`
  (X arată de cât timp așteaptă comanda), timp de **30 de minute**;
- după **12 minute** proprietarii primesc `⚠️ … nu a preluat comanda #1042`
  cu telefonul punctului, apoi din nou la fiecare 10 minute (de 3 ori).

Apeși „Am preluat” — totul se oprește imediat.

## Pentru proprietar

Trimite botului `/start COD-PROPRIETAR` (codul de la administrator). Vei primi
copia fiecărei comenzi din toate punctele (fără buton — doar informație) și
mesajele `⚠️ … nu a preluat comanda #…` cu telefonul punctului, ca să suni
imediat. Codul de proprietar poate fi folosit pe mai multe telefoane; după ce
toți s-au conectat, administratorul îl schimbă.

---

# Телефон точки — заказы с apetit.md через Telegram (русская версия)

Инструкция для кассира. Займёт 5 минут, делается один раз.

## 1. Подключите бота

1. Откройте Telegram на рабочем телефоне точки.
2. Найдите **@apetit_comenzi_bot** (или откройте t.me/apetit_comenzi_bot) и
   нажмите **Start**.
3. Отправьте сообщение: `/start КОД` — код даёт администратор (8 знаков,
   например `/start AB2CD3EF`).
4. Бот ответит: **«Точка подключена: Apetit …»**. Готово — заказы будут
   приходить в этот чат.

Ответ «Неверный код» — проверьте код (заглавные буквы, без пробелов).
Ответ «Точка уже подключена к другому чату» — код уже использован на другом
телефоне; попросите администратора переподключить.

## 2. Громкий звук для этого чата (обязательно)

Заказы должны быть слышны на кухне. Звук ставится **для чата с ботом**, а не
для всего Telegram.

**Android**
1. Откройте чат с ботом → нажмите на имя бота сверху.
2. **Уведомления** → включите **Настроить** (Customize).
3. **Звук** → выберите самый громкий (например «Сигнал»/«Сирена»),
   **Вибрация → Вкл.**, **Приоритет/Важность → Срочно** (если есть).
4. Настройки телефона → **Приложения → Telegram → Уведомления** → всё
   включено; **Батарея → Без ограничений** (иначе телефон «усыпляет»
   приложение).
5. Настройки → **Звук → Не беспокоить** → исключения → разрешить Telegram
   (или не включать «Не беспокоить» на работе).

**iPhone**
1. Откройте чат с ботом → нажмите на имя бота сверху.
2. **Уведомления** → **Настроить** → **Звук** → выберите долгий громкий звук.
3. Настройки iPhone → **Уведомления → Telegram** → Допуск уведомлений,
   **Звуки** вкл., Баннеры → **Постоянные**, **Срочные уведомления** вкл.
4. Настройки → **Фокусирование** (Не беспокоить / Работа) → добавьте Telegram
   в разрешённые приложения.
5. **Боковой переключатель не должен стоять на «без звука»**, громкость на
   максимум — иначе Telegram не зазвонит.

Названия пунктов могут немного отличаться по версиям; ищите «Уведомления» в
чате с ботом.

## 3. Что делать, когда пришёл заказ

Сообщение выглядит так: `🔴 НОВЫЙ ЗАКАЗ #1042`, имя клиента, телефон, адрес
(если доставка), блюда, ИТОГО, время.

1. **Позвоните клиенту** — нажмите на номер в сообщении, телефон наберёт его.
   Подтвердите заказ и время.
2. **Нажмите кнопку «✅ Принял»** под сообщением. Заголовок станет
   `🟢 ПРИНЯТ · 18:45 — #1042`, кнопка исчезнет. Заказ остаётся в чате — это
   ваша история.
3. Готовьте заказ.

Нажимайте «Принял» **только когда увидели заказ** — кнопка значит «взял в
работу».

## 4. Что значат ⏰ и ⚠️

Бот не видит, прочитали ли вы сообщение, — только кнопку. Поэтому, если
«Принял» не нажат:

- каждые **2 минуты** приходит `⏰ Заказ №1042 ждёт — X минут` (X — сколько
  заказ уже ждёт), и так **30 минут**;
- через **12 минут** владельцы получают `⚠️ … не принял заказ №1042` с
  телефоном точки, затем ещё раз каждые 10 минут (всего 3 раза).

Нажали «Принял» — всё прекращается сразу.

## Для владельца

Отправьте боту `/start КОД-ВЛАДЕЛЬЦА` (код у администратора). Вы будете
получать копию каждого заказа со всех точек (без кнопки — только информация)
и сообщения `⚠️ … не принял заказ №…` с телефоном точки, чтобы сразу
позвонить. Код владельца можно использовать на нескольких телефонах; когда
все подключились, администратор его меняет.
