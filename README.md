# Openrole — Phase 5

Поиск вакансий на Next.js App Router, React, TypeScript strict и Tailwind CSS. Frontend подключён к NestJS API и PostgreSQL/Prisma; ATS-источники синхронизируются через BullMQ/Redis. Интерфейс на английском языке.

## Запуск

Node.js 22.13+. Настройка источников и API описана в [backend/README.md](backend/README.md).

```sh
docker compose --profile backend up -d --build
npm ci
cp .env.example .env.local
npm run dev
```

```
Запуск Backend, база данных, Redis и worker -
docker compose --profile backend up -d
проверить статус backend - localhost:4000/health

Остановить Backend -
docker compose --profile backend stop
```

`APP_ORIGIN` — публичный HTTPS origin; без него robots.txt запрещает индексацию, а sitemap недоступен. `API_URL` — серверная переменная, по умолчанию `http://127.0.0.1:4000`. Браузер общается только с Next.js: для телефона не нужно открывать backend-порт или менять CORS. Для frontend в контейнере укажите доступное из него имя API, например `http://api:4000`.

Сайт: http://localhost:3000. Для телефона в той же сети: `npm run dev -- --hostname 0.0.0.0`, затем `http://192.168.50.149:3000`. При смене адреса обновите `allowedDevOrigins` в `next.config.ts`.

Production: `npm run build`, затем `npm start`. Backend запускается отдельно. Без включённых источников коллекции пусты.

После изменений backend при локальном Docker-запуске пересоберите **оба** сервиса: `docker compose --profile backend up -d --build api worker`. Иначе frontend может ссылаться на новые маршруты, которых нет в старом API-контейнере.

## Возможности

- `/`: общий SearchBar, реальные счётчики, свежие вакансии, компании, ссылки по категориям и регионам.
- `/jobs`: серверные поиск, фильтры, четыре сортировки и пагинация по 8 вакансий. Параметры в URL, back/forward и возврат из деталей сохраняют поиск. При изменении фильтра страница сбрасывается на первую.
- Desktop sidebar и мобильный dialog используют JobFilters. Черновик мобильных фильтров запрашивает число совпадений из API; Clear all сбрасывает все фильтры, включая Quick Filters.
- `/companies`: компании из API, число открытых вакансий и пагинация по 24 компании; `/companies/[slug]` — профиль и активные вакансии.
- `/jobs/[slug]`: исходное описание работодателя, зарплата, география, технологии, похожие вакансии и общий ApplyLink для desktop/mobile. Apply открывает applyUrl в новой вкладке без ожидания аналитики.
- SEO: canonical/robots, JobPosting JSON-LD для ACTIVE из реальных полей, sitemap index с частями до 5000 URL, crawlable ссылки пагинации, `/remote-jobs`, `/categories/[slug]`, `/technologies/[slug]`, `/locations/[slug]`. Курируемые страницы с менее 5 активными вакансиями и фильтрованные URL получают noindex.
- Загрузка со skeleton, пустые состояния, ошибки с повторным запросом и 404 UI. Публичный URL неизвестной вакансии отвечает HTTP 404, удалённой после retention — HTTP 410. При ошибке поиска фильтры остаются доступны.
- Общий дизайн, кастомные Select, доступность, нижняя мобильная навигация и адаптивность сохранены.

## Структура

```text
app/                    Страницы, metadata, loading, error boundary
app/api/jobs/count/     Серверный proxy счётчика мобильных фильтров
components/             Общие SearchBar, Select, ApplyLink, JobSkeleton и UI
features/jobs/          Типы, URL-параметры, карточки и фильтры
lib/api.ts              Серверный API client, DTO, таймаут и преобразование данных
lib/api-query.ts        Перевод UI-фильтров в query API, компактная пагинация
lib/format.ts           Зарплаты, даты и география
styles/                 CSS: variables, base, components, pages
backend/                NestJS API, Prisma, ATS, worker и тесты
compose.yaml            PostgreSQL, Redis, API и worker
tests/fixtures/         Данные только для тестовой БД
tests/support/          Запуск настоящего API с тестовыми данными
```

CSS импортируется по файлам в `app/layout.tsx`; Tailwind сохранён. Карта стилей и правила оформления — [styles/README.md](styles/README.md).

## Данные и границы фазы

- Импорт поддерживает Greenhouse, Lever (включая EU), Ashby, SmartRecruiters, Personio XML и Recruitee XML. Каталог [backend/sources.europe.json](backend/sources.europe.json) добавляет 32 компании; новые boards подключаются через `/admin/sources`. Настройка и ограничения — [backend/README.md](backend/README.md#источники-и-ручной-запуск). Worker синхронизирует включённые источники ежечасно; вакансии поступают из внешних API/фидов, API для приёма партнёрских вакансий отсутствует.
- Runtime mock-данных нет. Запросы выполняются с `cache: no-store` и таймаутом 10 секунд. Ошибка API не выдаётся за пустую коллекцию.
- География сопоставляется с явно переданными country/region/location: страна не угадывается по городу, а Remote не означает Worldwide. EU/Europe учитывают известные структурированные коды стран. Other — записи вне распознанных групп, включая неизвестную географию. Возможность найма подтверждает работодатель.
- При отсутствии `publishedAt` показываются Added / First seen. Сортировка и фильтр свежести используют публикацию либо первое обнаружение. Повторный импорт не обновляет эту дату.
- Зарплаты — структурированные годовые суммы. Частичные диапазоны отображаются From / Up to, неизвестные суммы не выдумываются. Валюты не конвертируются; для зарплатного фильтра/сортировки по умолчанию USD. Технологии и слова поиска соединяются через AND.
- Описание вакансии — очищенный HTML из источника, при его отсутствии — текст. Описание компании не генерируется; при отсутствии логотипа показывается placeholder.
- Page views, job views и Apply clicks отправляются через first-party endpoint `/api/events` без ожидания ответа. URL-параметры поиска, raw IP и полные user-agent не сохраняются. Подробнее — `/privacy`.
- Кабинеты соискателей и работодателей, OAuth, Saved и Alerts остаются UI-прототипами. Вход владельца `/admin/login` — отдельная настоящая авторизация. Страницы admin/auth всегда закрыты от индексации.

## Проверки

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm --prefix backend run build
npx playwright install chromium firefox webkit
# Сначала настройте TEST_DATABASE_URL и миграции отдельной *_test базы: backend/README.md.
npm run test:e2e
```

E2E заполняет **отдельную `*_test` базу** фикстурами, запускает настоящий Nest API на 4001 и production frontend на 3100. Не запускайте одновременно с backend integration tests: тестовая база очищается перед E2E. Обычная база не затрагивается. Проверяются поиск, фильтры, URL/history, Apply, drawer и адаптивность 280–1440 px в Chromium, Firefox и WebKit. Скриншоты — `test-results/`.

Phase 5 добавляет жизненный цикл: три успешных пропуска в течение минимум 24 часов закрывают вакансию; через 30 дней CLOSED очищаются с сохранением аналитики. API и публичный URL удалённой вакансии отдают 410. Ошибочные снимки не засчитываются. Миграции и расписание описаны в backend/README.md.

## Панель владельца

```sh
npm run admin:setup
docker compose --profile backend up -d --build
# Перезапустить frontend после настройки окружения:
npm run dev -- --hostname 0.0.0.0
```

Откройте `/admin`. Случайный пароль сохраняется в `.owner-credentials.local` (gitignored, права 0600). После сохранения пароля в менеджере паролей файл можно удалить. Команда создаёт `.env.owner` для Docker API и добавляет INTERNAL_API_KEY в `.env.local` для Next.js; секреты не публикуются в браузере. Повторная настройка требует `npm run admin:setup -- --rotate`: прежние сессии становятся недействительны после перезапуска backend. Для собственного пароля задайте ADMIN_PASSWORD (минимум 14 символов) через безопасное окружение перед командой.

- `/admin` — автообновление раз в 30 секунд только в видимой вкладке с сетью, без параллельных запросов (при ошибках пауза 60–120 секунд); KPI, центральный Traffic & engagement chart с пятью сериями, уникальной Apply conversion и сравнением периодов, интервалы Today/Yesterday/7/30/90, карта, страны, города, источники, кампании, устройства и top jobs.
- `/admin/jobs` — поиск, статус, правки, hide/unhide, close/reopen и удаление с подтверждением. Ручные правки и статусы защищены от следующего импорта; Use source data снимает защиту для следующей синхронизации. Удалённая вакансия не импортируется заново благодаря tombstone по source/externalId.
- `/admin/companies` — создание, редактирование, включение/выключение. Выключенная компания исчезает из публичной выдачи вместе со своими вакансиями; новые импорты не запускаются.
- `/admin/sources` — Greenhouse/Lever/Ashby, идентификатор board, включение/выключение, ручная постановка sync. Компания и board существующего источника неизменяемы: создайте новый источник, чтобы сохранить происхождение старых вакансий.
- `/admin/logs` — время, исход импорта, found/created/updated/closed и ошибки. После постановки sync обновите журнал кнопкой Refresh.

### Окружение и границы

В production используйте HTTPS, удалите локальное `ADMIN_COOKIE_SECURE=false` (либо задайте `true`) и укажите `APP_ORIGIN=https://your-domain`. Для ручного запуска Nest вне Docker задайте OWNER_PASSWORD_HASH и INTERNAL_API_KEY из защищённого окружения. INTERNAL_API_KEY должен совпадать у API и Next.js. Без настройки owner-доступ закрыт.

`GEO_PROVIDER=none` по умолчанию. `vercel` и `cloudflare` допускаются только за соответствующей доверенной инфраструктурой, которая удаляет/заменяет входящие geo headers. Для Cloudflare region/city должны быть дополнительно настроены на edge. На localhost география остаётся Unknown. Слой `lib/geo.ts` позволяет добавить другой GeoProvider без изменения событий.

Analytics использует случайный visitor ID с истечением через 30 дней и tab session с таймаутом 30 минут. DNT/GPC и opt-out на `/privacy` отключают сбор. Страницы admin/auth и посещения с owner-cookie исключены. Сохраняются только hostname реферера и ограниченные UTM-теги, а не полные referrer URL. Page view фиксируется при смене pathname; смена поисковых фильтров не создаёт отдельный page view. Job views и Apply clicks — отдельные события; CTR не означает завершённую заявку.

Raw events хранятся 90 дней, import logs — 30 дней; hourly worker удаляет просроченные данные и owner-сессии. Отчёты агрегируются SQL по часам/дням, географии, источнику и вакансии. Граница `analyticsReport` позволяет позже добавить исторические агрегаты, не меняя UI; бессрочного event storage нет. CTR ranking требует минимум 5 просмотров. Inventory отражает все записи, включая отключённые источники; временные фильтры относятся к аналитике. Карта — локальные SVG paths Natural Earth (public domain), без mapping-библиотеки; мелкие страны могут отсутствовать на геометрии масштаба 1:110m, но остаются в таблицах.

Owner-сессия — случайный 256-bit token, hash в PostgreSQL, httpOnly + SameSite=Strict cookie, срок 8 часов и отзыв при logout/смене пароля. Запросы изменения проверяют Origin, API повторно проверяет owner-сессию. MVP rate limits действуют внутри одного API-процесса; перед горизонтальным масштабированием их нужно перенести в Redis. Admin и сбор событий не должны обходить Next.js через открытый proxy с INTERNAL_API_KEY.

Браузерные owner-проекты запускаются после публичных regression-проектов: их изменения тестовых записей не влияют на прежние проверки. Для быстрой проверки панели: `npm run test:e2e -- --project=owner-desktop --no-deps`. Redis DB 15 используется только для тестовой очереди; worker рабочего проекта к ней не подключается.
