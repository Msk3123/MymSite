# Мамина шафа

Магазин дитячих речей: бекенд на .NET 10 (Clean Architecture) + фронт на React.

```
SIteMym.sln
src/
├── SiteMym.Domain/                 # без залежностей
│   ├── Common/                     # Entity, Result<T>, Error, Slug
│   ├── Products/                   # Product, ProductPhoto, Measurement, ProductDetails, enum-и, ProductErrors
│   └── Orders/                     # Order, OrderItem, Customer, DeliveryAddress, BulkDiscount, OrderErrors
├── SiteMym.Application/            # → Domain
│   ├── Abstractions/Messaging/     # IQueryHandler, ICommandHandler (реєструються автоматично)
│   ├── Abstractions/Persistence/   # IUnitOfWork, IProductRepository, IOrderRepository
│   ├── Abstractions/Storage/       # IFileStorage (де лежать фото)
│   ├── Abstractions/Ai/            # IChatModel (мовна модель з function calling)
│   ├── Common/                     # PagedList<T>, ShopSettings, ShopClock (час за Києвом)
│   ├── Products/                   # каталог + Manage/ (адмінка: створення, редагування, фото, статуси)
│   ├── Orders/                     # PlaceOrder + Manage/ (адмінка: список, підтвердити/відправити/…)
│   ├── Dashboard/                  # зведення для головної адмінки
│   └── Assistant/                  # ШІ-помічник: промпт з інструкцією, інструменти, цикл запитів
├── SiteMym.Infrastructure/         # → Application
│   ├── Persistence/                # AppDbContext, Configurations/, Repositories/, Migrations/, Seed/
│   ├── Storage/                    # LocalFileStorage — фото на диску сервера
│   └── Ai/                         # OpenAiChatModel — Chat Completions без SDK
└── SiteMym.Api/                    # → Application, Infrastructure
    ├── Endpoints/                  # Products/, Orders/, Admin/ (IEndpoint, Minimal API)
    ├── Auth/                       # вхід мами: кука + хеш пароля з конфігу
    └── Common/                     # KebabEnum, ApiResults (Error → ProblemDetails)
client/                      # React + Vite + TypeScript, сторінки з макета Claude Design
```

## База даних (PostgreSQL)

Рядок підключення без пароля лежить в `appsettings.Development.json`. Повний рядок з паролем зберігай в user-secrets, щоб він не потрапив у git:

```bash
dotnet user-secrets set "ConnectionStrings:Database" "Host=localhost;Port=5432;Database=mamyna_shafa;Username=postgres;Password=<пароль>" --project src/SiteMym.Api
```

У Development під час старту API міграції накочуються самі, а порожня база заповнюється тестовими речами (`Persistence/Seed/DevelopmentSeeder.cs`). Базу `mamyna_shafa` Postgres створить сам. Нова міграція:

```bash
dotnet ef migrations add <Name> --project src/SiteMym.Infrastructure --startup-project src/SiteMym.Api --output-dir Persistence/Migrations
```

## Запуск

```bash
# бекенд — http://localhost:5184 (перевірка: GET /api/health — показує й стан БД)
dotnet run --project src/SiteMym.Api --launch-profile http

# фронт — http://localhost:5173 (запити на /api проксіюються на бекенд)
cd client
npm install
npm run dev
```

## Сервер (бойовий сайт)

**https://shafa.134-209-235-187.sslip.io** · кабінет `/admin` · DigitalOcean (Frankfurt, 2 GB, Ubuntu 24.04).

```bash
bash deploy/deploy.sh      # викласти останній коміт: збірка на сервері + перезапуск (~1–3 хв)
ssh shafa-server           # зайти на сервер (ключ ~/.ssh/hetzner_ed25519, див. ~/.ssh/config)
ssh shafa-server 'cd /opt/sites && docker compose logs --tail 100 shafa'   # логи
```

- `/opt/sites`: `docker-compose.yml` + `Caddyfile` (з `deploy/server`), `.env` із секретами (лише на сервері, `chmod 600`),
  код у `/opt/sites/shafa`. Сервіси: `db` (PostgreSQL 17, одна на всі сайти), `shafa`, `caddy` (HTTPS від Let's Encrypt).
- Фото й ключі входу — у томі `sites_shafa-data`, база — `sites_pgdata`.
- Бекап щоночі о 03:30 (Київ): `/opt/backups`, 14 днів (`deploy/server/backup.sh`). Він на тому ж сервері —
  для захисту від втрати самого сервера варто ввімкнути Backups у панелі DigitalOcean.
- Firewall: відкриті лише 22, 80, 443. Swap 2 ГБ. Автооновлення безпеки Ubuntu.
- Другий сайт: ще один сервіс у `docker-compose.yml` + блок у `Caddyfile` (місце вже підготовлене).

## Живий сайт з цього комп'ютера (безкоштовно, тимчасово)

Поки немає сервера, сайт можна відкрити в інтернет прямо з цього ПК через [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) — без реєстрації, з HTTPS:

```powershell
winget install --id Cloudflare.cloudflared          # один раз
powershell -ExecutionPolicy Bypass -File deploy\start-live.ps1
```

Скрипт збирає сайт, публікує API (Release) і запускає все одним процесом на `http://localhost:5200`, а потім друкує
адресу виду `https://….trycloudflare.com` — її й даємо мамі (кабінет: `…/admin`).

- Окремо від розробки: база `mamyna_shafa_live`, фото в `data/uploads`, тестових речей немає.
- Пароль кабінету — у `secrets/admin-password.txt` (папка не потрапляє в git), логін `mama`.
  Новий пароль: `dotnet run --project src/SiteMym.Api -- hash-password "пароль" > secrets/admin-password-hash.txt`.
- Обмеження: працює, поки увімкнений ПК і відкрите вікно скрипта; **адреса змінюється при кожному запуску**.
- Переїзд на сервер: `pg_dump mamyna_shafa_live` + папка `data/uploads` — і все, що мама додала, переїде.

## Кабінет продавчині (`/admin`) — макет «Версія 2.0»

Вхід — логін і пароль. Адмін один, тому без таблиці користувачів: логін і **хеш** пароля лежать у конфігурації.

- **Локально** вже налаштовано в `appsettings.Development.json`: логін `mama`, пароль `mama-dev-2026` (лише для розробки!).
- **На сервері** — свій пароль, і не в git:

```bash
dotnet run --project src/SiteMym.Api -- hash-password "надійний пароль"
# отриманий хеш → у змінну оточення Admin__PasswordHash (або user-secrets "Admin:PasswordHash")
```

Кука `HttpOnly`, `SameSite=Strict`, живе 30 днів. Вхід — не більше 5 спроб на хвилину з однієї IP.
Ім'я в кабінеті — `Shop:OwnerName` / `Shop:OwnerNameVocative` в `appsettings.json`.

| Розділ | Що там |
|---|---|
| Сьогодні | картки (нові, відправити, на сайті, за місяць), «Що зробити зараз», продажі по тижнях, «Довго не продаються» (кнопка −10%) |
| Замовлення | вкладки зі лічильниками, пошук (ім'я / телефон / № / ТТН), список + картка: етапи, історія покупця, фото й «де лежить» речей, нотатка для себе |
| Мої речі | таблиця (на телефоні — картки), вкладки, пошук, галочки → «Знижка −10%» / «Сховати з сайту», колонка «Де лежить» |
| Нова річ | 4 слоти фото (вигляд, бірка, деталі, дефект), **«Заповнити з фото»** (ШІ читає бірку), підказка ціни, «Чернетка» / «Опублікувати на сайті» |
| Помічник | чат на всю сторінку + плаваючий помічник на кожній сторінці, який «бачить», що відкрито; голосовий ввід (розпізнавання браузера, безкоштовно) |

Ще не зроблено з макета (потрібні інтеграції): «Повідомлення» (Telegram/Viber), «Покупці», «Налаштування», оплати й прострочені броні,
«Шукали, але немає», лоти, пости для Instagram.

### Фото

Браузер стискає фото до 1600 px / JPEG 85% (200–500 КБ), сервер перевіряє, що це справді JPG/PNG/WebP (за першими байтами), і кладе в
`src/SiteMym.Api/uploads/products/{id речі}/{guid}.jpg`. Роздає їх API за адресою `/uploads/…` з кешем на рік.
Папка в `.gitignore` — **на сервері її треба бекапити разом з базою.** Коли захочеться в хмару (Cloudflare R2 / S3 / Azure Blob) —
нова реалізація `IFileStorage`, решта коду не зміниться.

### ШІ-помічник (OpenAI)

Ключ — **тільки в user-secrets** (лежать у профілі Windows, не в репозиторії), на сервері — змінна оточення `OpenAI__ApiKey`:

```bash
dotnet user-secrets set "OpenAI:ApiKey" "sk-..." --project src/SiteMym.Api
```

- **Чат** — модель бачить замовлення, речі, зведення й «де лежить» через інструменти (лише читання — нічого змінити не може).
  Інструкцію по кабінету бере сама, коли треба, — інструментом `get_help(topic)` (`AssistantGuide` в
  `Application/Assistant/AssistantPrompt.cs` — **оновлюй текст, коли змінюєш кнопки**). Телефонів покупців моделі не віддаємо.
  ≈0.8–2 тис. токенів на питання (було ~4.4 тис. до винесення інструкції в інструмент) ≈ $0.0003.
- **«Заповнити з фото»** — `POST /api/admin/assistant/describe`: браузер зменшує фото (бірка — 512 px по короткій
  стороні, решта — 512 px), бірку модель роздивляється крупно, решту — дешево; відповідь — строгий JSON (structured outputs).
  ≈18 тис. токенів ≈ $0.003 за одну річ.
- **Пам'ять** — таблиця `assistant_notes` (до 60 нотаток по 300 символів). Помічник сам записує сталі факти
  («Reima ставлю від 300 грн», «зимове — в синю коробку») інструментами `remember`/`forget` у будь-якому режимі
  (нотатки нічого не змінюють у магазині). Нотатки йдуть у кожну розмову окремим системним повідомленням одразу після
  незмінного промпту, а також у «Заповнити з фото» — звідти підставляються ціна, «де лежить» і стиль опису.
  Мама бачить і править їх: кнопка «Пам'ять» на сторінці «Помічник».
- У логах API на кожен виклик: `OpenAI usage: prompt N (cached N), completion N tokens`.
- Модель — `OpenAI:Model` (за замовчуванням `gpt-4o-mini`). Ліміт — 15 запитів на хвилину.
- Без ключа кабінет працює, а помічник показує «ще не підключений».

## API

| Метод | Шлях | Що робить |
|---|---|---|
| GET | `/api/products?gender=boy&size=98&season=autumn-winter&conditions=new,like-new&category=outerwear&minPrice=&maxPrice=&search=&sort=newest\|price-asc\|price-desc&includeSold=true&page=1&pageSize=24` | Каталог |
| GET | `/api/products/count?…ті самі фільтри` | Лічильники у фільтрах |
| GET | `/api/products/{slug}` | Сторінка товару |
| GET | `/api/products/lookup?slugs=msh-0412,msh-0388` | Свіжі дані для кошика |
| POST | `/api/orders` | Оформлення: `{fullName, phone, city, branch, payment: card\|cash-on-delivery, comment, productIds}` |
| GET | `/api/health` | Стан API і БД |
| POST | `/api/admin/login`, `/logout`, GET `/me` | Вхід у кабінет |
| GET | `/api/admin/summary` | Зведення |
| GET/POST/PUT/DELETE | `/api/admin/products[/{id}]`, `POST …/{id}/status {action: publish\|unpublish\|mark-sold}` | Речі |
| POST/DELETE | `/api/admin/products/{id}/photos[/{photoId}[/cover]]` | Фото (multipart `file`, `isDefect`) |
| GET | `/api/admin/orders?status=new`, `POST …/{number}/status {action: confirm\|ship\|complete\|cancel, trackingNumber}` | Замовлення |
| GET/POST | `/api/admin/assistant` | Помічник: увімкнений? / питання `{messages:[{role,text}], context}` |
| POST | `/api/admin/assistant/describe` | Заповнити картку з фото (multipart `files` ≤4, `tagIndex`) |
| GET/POST/PUT/DELETE | `/api/admin/assistant/notes[/{id}] {text}` | Пам'ять помічника |
| POST | `/api/admin/products/bulk {ids, action: hide\|discount10}` | Масові дії |
| GET | `/api/admin/products/price-hint?category=hats` | Підказка ціни |
| PUT | `/api/admin/orders/{number}/note {note}` | Нотатка для себе |

Enum-и в JSON і query — kebab-case, як у фронтових URL. Помилки — ProblemDetails з полем `code` (`Order.InvalidPhone`, `Product.NotAvailable` → 409).

## Сторінки

| Маршрут | Що там |
|---|---|
| `/` | Головна: для кого, зріст, сезон, комплекти, про продавчиню |
| `/catalog?gender=boy&size=98` | Каталог: фільтри в URL, сортування, «показати ще», порожній стан |
| `/product/:id` | Товар: галерея, шкала стану, заміри, «Замовити» |
| `/checkout` | Кошик + форма без реєстрації, знижка від 3 речей |
| `/admin` | Кабінет продавчині (окремий бандл, покупці його не завантажують) |

Усі дані — з API. Кошик у `localStorage` зберігає лише slug-и; ціни й статуси щоразу підтягуються з сервера.
Є фото — показуємо фото; немає — силует речі з макета (`client/src/lib/placeholderArt.ts`).
Контакти продавчині — `client/src/config.ts`.
