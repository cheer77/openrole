# Openrole — Phase 3

Поиск вакансий на Next.js App Router, React, TypeScript strict и Tailwind CSS. Frontend подключён к NestJS API и PostgreSQL/Prisma; ATS-источники синхронизируются через BullMQ/Redis. Интерфейс на английском языке.

## Запуск

Node.js 22.13+. Настройка источников и API описана в [backend/README.md](backend/README.md).

```sh
docker compose --profile backend up -d --build
npm ci
cp .env.example .env.local
npm run dev
```

`API_URL` — серверная переменная, по умолчанию `http://127.0.0.1:4000`. Браузер общается только с Next.js: для телефона не нужно открывать backend-порт или менять CORS. Для frontend в контейнере укажите доступное из него имя API, например `http://api:4000`.

Сайт: http://localhost:3000. Для телефона в той же сети: `npm run dev -- --hostname 0.0.0.0`, затем `http://192.168.50.149:3000`. При смене адреса обновите `allowedDevOrigins` в `next.config.ts`.

Production: `npm run build`, затем `npm start`. Backend запускается отдельно. Без включённых источников коллекции пусты.

## Возможности

- `/`: общий SearchBar, реальные счётчики, свежие вакансии, компании, ссылки по категориям и регионам.
- `/jobs`: серверные поиск, фильтры, четыре сортировки и пагинация по 8 вакансий. Параметры в URL, back/forward и возврат из деталей сохраняют поиск. При изменении фильтра страница сбрасывается на первую.
- Desktop sidebar и мобильный dialog используют JobFilters. Черновик мобильных фильтров запрашивает число совпадений из API; Clear all сбрасывает все фильтры, включая Quick Filters.
- `/companies`: компании из API, число открытых вакансий и пагинация по 24 компании.
- `/jobs/[slug]`: исходное описание работодателя, зарплата, география, технологии и общий ApplyLink для desktop/mobile. Apply открывает applyUrl в новой вкладке без ожидания аналитики.
- Загрузка со skeleton, пустые состояния, ошибки с повторным запросом и 404 UI. При streaming Next.js может вернуть HTTP 200 с noindex для отсутствующей вакансии; API возвращает 404. При ошибке поиска фильтры остаются доступны.
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

- Runtime mock-данных нет. Запросы выполняются с `cache: no-store` и таймаутом 10 секунд. Ошибка API не выдаётся за пустую коллекцию.
- География сопоставляется с явно переданными country/region/location: страна не угадывается по городу, а Remote не означает Worldwide. EU/Europe учитывают известные структурированные коды стран. Other — записи вне распознанных групп, включая неизвестную географию. Возможность найма подтверждает работодатель.
- При отсутствии `publishedAt` показываются Added / First seen. Сортировка и фильтр свежести используют публикацию либо первое обнаружение. Повторный импорт не обновляет эту дату.
- Зарплаты — структурированные годовые суммы. Частичные диапазоны отображаются From / Up to, неизвестные суммы не выдумываются. Валюты не конвертируются; для зарплатного фильтра/сортировки по умолчанию USD. Технологии и слова поиска соединяются через AND.
- Описание — текст, преобразованный backend из HTML. React экранирует его; переносы сохраняются. Описание компании не генерируется, логотип заменяется нейтральными инициалами.
- `data-job-id` в карточках/деталях и `data-event="apply-click"` у ApplyLink — точки подключения будущей аналитики. Сейчас событий аналитики нет, переход не блокируется.
- Авторизация, кабинеты, Saved и Alerts остаются UI-прототипами. Admin и аналитика относятся к Phase 4, которая не начата. `noindex` сохраняется до подготовки публичного запуска; JobPosting JSON-LD пока нет.

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

Phase 4 начинается только по явной команде пользователя.
