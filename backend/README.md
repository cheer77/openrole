# Openrole backend — Phase 4

NestJS 12 (ESM), PostgreSQL 17, Prisma 7, Redis 7, BullMQ. Backend — отдельный npm-пакет. В Phase 3 frontend подключён к API через сервер Next.js (`API_URL`); mock-данные используются только в изолированных тестах. Owner API и privacy-conscious аналитика реализованы в Phase 4. Кабинеты соискателей/работодателей и OAuth остаются за границами фазы.

## Быстрый запуск

Из корня проекта:

```sh
docker compose up -d postgres redis
cd backend
cp .env.example .env
npm ci
npm run build
npm run db:migrate
npm start
```

API: `http://127.0.0.1:4000`. В другом терминале из `backend/`:

```sh
npm run worker
```

Полный backend в Docker (из корня):

```sh
docker compose --profile backend up -d --build
```

API применяет миграции перед запуском; worker стартует после успешного healthcheck API. PostgreSQL и Redis сохраняют данные в volumes. Порты опубликованы только на loopback: PostgreSQL `5433`, Redis `6380`, API `4000`. Пароль `openrole_local` в примере предназначен для локальной разработки; в размещённом окружении задайте собственные `POSTGRES_PASSWORD` и URLs. `docker compose down` останавливает сервисы, сохраняя данные; не добавляйте `-v`, если данные нужны.

Для разработки после изменений запустите `npm run build`, затем перезапустите API и worker. Конфигурация проверяется при запуске. `HOST`, `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `REDIS_URL` перечислены в `.env.example`.

## Источники и ручной запуск

Публичных изменяющих API пока нет. Компании и источники управляются защищённой панелью `/admin`; локальная CLI также доступна:

```sh
cp sources.example.json sources.local.json
# У нужных источников установите enabled: true, проверьте company и sourceIdentifier.
npm run sources:import -- sources.local.json
npm run sync
```

Повторный импорт конфигурации обновляет существующие записи, не создавая дубликатов. Источник закреплён за одной компанией. `enabled: false` исключает его из синхронизации и публичной выдачи; отсутствие источника в JSON не удаляет его. `MANUAL` поддерживается в модели, но автоматически не импортируется. Произвольный URL как identifier не принимается.

| Provider | Source identifier | Интерфейс |
| --- | --- | --- |
| GREENHOUSE | `adyen` | Public Job Board API, JSON |
| LEVER | `qonto`, либо `eu:company` для EU instance | Public Postings API, JSON |
| ASHBY | `n8n` | Public Job Posting API, JSON |
| SMARTRECRUITERS | `Wise` | Public Posting API, список + полные описания |
| PERSONIO | `personio` для .com, `de:company` для .de | Включённый работодателем XML feed, язык en |
| RECRUITEE | `bunq` | Public formatted XML feed `/api/feeds/offers.xml` |

Новый источник добавляется через `/admin/companies` → `/admin/sources` → **Add source**: выбрать компанию и провайдера, указать identifier, включить Enabled и нажать **Sync now**. Ключ для этих публичных интерфейсов не нужен. Это импорт из сторонних API/фидов, а не endpoint приёма партнёрских вакансий. Для другого формата/API нужен отдельный `JobProvider`; вставка произвольного URL не создаёт адаптер автоматически.

`sources.europe.json` — каталог 32 включённых источников европейских и международных работодателей с присутствием в Европе (проверен 2026-10-08). Он дополняет три начальных источника, не заменяя их. Импортируется весь публичный board, в том числе вакансии за пределами Европы. Количество позиций меняется, статических вакансий/счётчиков в каталоге нет. Фильтр Europe работает по фактическим данным вакансии; страна не выводится из адреса головного офиса. Доступность API не является подтверждением лицензии на перепубликацию: условия использования данных определяет работодатель/провайдер.

```sh
# Из backend/ после build и db:migrate:
npm run sources:import -- sources.europe.json
npm run sync
# Или из корня при Docker backend:
docker compose exec -T api node dist/src/cli.js sources sources.europe.json
docker compose exec -T api node dist/src/cli.js sync
```

Примеры в `sources.example.json` выключены по умолчанию; каталог `sources.europe.json` включён явно. Реальные вакансии не включены в seed. Чтобы поставить в очередь один источник: `npm run sync -- SOURCE_ID`. Worker должен работать, иначе задания остаются в Redis. В Docker CLI доступна через `docker compose exec api node dist/src/cli.js sync` (для JSON используйте файл внутри контейнера).

## API

`GET /health` проверяет PostgreSQL и возвращает 503 при недоступности.

`GET /jobs` возвращает `{ items, total, page, limit, pages, currency }`. В списке нет полного description; `GET /jobs/:slug` возвращает полную вакансию и компанию. Закрытые, скрытые и вакансии выключенных источников возвращают 404.

Параметры поиска:

| Параметр | Формат |
| --- | --- |
| `search` | до 150 символов, все слова должны встретиться в title/company/description |
| `category` | категория, сравнение без учёта регистра |
| `location` | Worldwide, Europe, EU, Spain, Germany, UK, USA, Other; явные country/region/location, без вывода страны по городу или Worldwide из remote |
| `country`, `region` | точное значение без учёта регистра; страна при наличии нормализуется (например ES, US) |
| `remoteType` | REMOTE, HYBRID, ON_SITE, UNKNOWN |
| `experience` | Junior, Middle, Senior, Lead |
| `technologies` | список через запятую, например React,TypeScript; логика AND |
| `salaryMin`, `salaryMax` | пересечение с годовым диапазоном, неотрицательные числа |
| `currency` | трёхбуквенный код в верхнем регистре; для зарплатного фильтра/сортировки по умолчанию USD |
| `posted` | 1, 3, 7, 30 дней |
| `sort` | newest (по умолчанию), oldest, salary-high, salary-low |
| `page`, `limit` | page 1–10000, limit 1–100 (по умолчанию 20) |

Пример: `GET /jobs?search=Frontend&remoteType=REMOTE&technologies=React&sort=newest&page=1&limit=20`.

`GET /companies?search=Stripe&page=1&limit=20` возвращает `{ items, total, page, limit, pages }`. В каждой компании `_count.jobs` — число публично доступных активных вакансий.

Неверные и неизвестные query-параметры возвращают 400. Сортировка имеет устойчивый второй ключ ID; total и items читаются в одной repeatable-read транзакции. Валюты не конвертируются. Неизвестная зарплата исключается из зарплатных фильтров/сортировки; при частичном диапазоне null сортируется последним.

## Импорт и защита данных

- Шесть адаптеров реализуют `JobProvider`; `providers/http.ts` ограничивает сетевые ответы, `source-config.ts` проверяет provider-specific identifiers одинаково в CLI, admin и адаптерах. Ошибка любой записи отклоняет снимок целиком, сохраняя предыдущие данные.
- Полные списки локаций сохраняются до 5000 символов (также в owner editor). Nullable `workplaceType`, `isRemote` и `address` в Ashby допустимы: отсутствующие сведения остаются неизвестными.
- Greenhouse проверяет `meta.total`, Lever читает все страницы (включая EU instance), Ashby импортирует только `isListed: true`. Ограничения: 20 MB на ответ, 20 секунд на запрос, максимум 20000 записей; достижение лимита Lever считается ошибкой, а не полным снимком.
- SmartRecruiters проверяет `offset`, стабильность `totalFound` и уникальность ID на всех страницах по 100. Полные описания загружаются отдельно, последовательно, с паузой 250 ms между запросами; при двух worker jobs это не более 8 запросов/s суммарно. Неверный ID/компания, неактивная вакансия или ошибка detail отменяют снимок. URL `ref` из ответа не используется для запросов. Импорт ограничен 30 минутами для больших boards; до записи удерживается только advisory lock, не блокирующий публичное чтение. Owner-редактирование вакансий этого источника в это время возвращает 409.
- Personio/Recruitee используют XML с проверкой синтаксиса/корневого элемента, запретом DOCTYPE/ENTITY и отключённым расширением entities. Фиксированные hosts и запрет redirects исключают произвольные запросы из identifier. Пустой валидный корень — пустой снимок, HTML/error payload не считается пустым board. Стандартные XML entities декодируются без DTD. Personio `createdAt` не подставляется как дата публикации; Recruitee использует `published_at`. Recruitee выбран именно XML: объявленное требование токена для Careers JSON API с 10 февраля 2027 не относится к XML feed.
- Внешний HTML преобразуется в текст. API не выдаёт HTML для прямой вставки. Категория и явно указанная старшинство определяются по заголовку; неподтверждённые значения остаются Other/null. Remote/Hybrid берутся из структурного поля либо явного указания в location. География из описания не угадывается.
- Сравниваются только структурированные годовые зарплаты. Часовые ставки, бонусы и equity не превращаются в годовые суммы. Неизвестные поля остаются null.
- Дедупликация — уникальный `(sourceId, externalId)`; slug создаётся один раз с устойчивым хешем и сохраняется при переименовании. Cross-source fuzzy matching отсутствует.
- `publishedAt` — дата источника, `firstSeenAt` — первое обнаружение, `lastCheckedAt` — последнее подтверждение присутствия. `sortDate` равен publishedAt, иначе firstSeenAt. Greenhouse `updated_at` не выдаётся за публикацию. Повторный импорт не делает старые вакансии свежими.
- Отсутствие вакансии в полном успешном снимке задаёт `missingSince`. Закрытие происходит после повторного подтверждения минимум через 24 часа. Это применяется и к пустому board. HTTP-ошибка, timeout, дубликаты ID и неверная структура не закрывают вакансии. CLOSED сохраняются; повторное появление возвращает ACTIVE. HIDDEN не раскрываются автоматически.
- Весь импорт одного источника атомарен. PostgreSQL advisory lock исключает одновременную обработку источника; BullMQ deduplication исключает повторную постановку активного задания. Worker запускает общий scheduler раз в час, обрабатывает не более двух заданий одновременно, делает три попытки с exponential backoff.
- Последняя попытка, успешная синхронизация и ошибка доступны в Source. Структурированные сообщения worker содержат created/updated/closed. Redis хранит последние 100 завершённых и 200 неуспешных заданий. Исторические ImportLog сохраняют исход каждой попытки (SUCCESS/FAILED/SKIPPED/INTERRUPTED), времена и счётчики и доступны в `/admin/logs`.

## Проверки

```sh
npm run lint
npm run typecheck
npm test
```

Unit-тесты проверяют адаптеры, нормализацию, URL validation, пагинацию Lever и фильтры. Интеграционные тесты используют отдельную базу с именем, заканчивающимся на `_test`:

```sh
# Из корня, один раз:
docker compose exec -T postgres createdb -U openrole openrole_test
cd backend
DATABASE_URL=postgresql://openrole:openrole_local@127.0.0.1:5433/openrole_test npm run db:migrate
npm run test:integration
```

`TEST_DATABASE_URL` задаётся в `.env`; тест не допускает имя обычной базы; тестовые события очищаются, поэтому эту базу нельзя использовать для иных данных. Проверяются импорт/повторный импорт, сохранение дат и slug, ошибки источника, закрытие/повторное открытие, HIDDEN, отключение источника, реальные HTTP-ответы, query validation, owner-сессии, ручные правки, tombstone, analytics validation и retention.

Prisma Client генерируется при build и не хранится в git. Миграции хранятся в git и применяются через `migrate deploy`. Зафиксированы overrides для исправленных `deepmerge-ts` и `mysql2`, используемых Prisma CLI; совместимость проверяется генерацией клиента и миграциями.

Официальные спецификации: [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Lever Postings API](https://github.com/lever/postings-api), [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api), [SmartRecruiters Posting API](https://developers.smartrecruiters.com/docs/endpoints), [Personio XML](https://support.personio.de/hc/en-us/articles/207576365-Integrate-jobs-from-Personio-into-your-website-via-XML), [Recruitee XML feeds](https://support.recruitee.com/en/articles/8213076-faq-api), [Recruitee authentication changes](https://docs.recruitee.com/reference/authentication-1), [BullMQ schedulers](https://docs.bullmq.io/guide/job-schedulers).


## Owner API и аналитика

В корне выполните `npm run admin:setup`, затем пересоберите Docker backend. Секреты хранятся в gitignored `.env.owner`, пароль — в `.owner-credentials.local` с правами 0600. При запуске без Docker передайте `OWNER_PASSWORD_HASH` и `INTERNAL_API_KEY` из защищённого окружения; Next.js должен использовать тот же внутренний ключ. Подробная настройка и ротация — в корневом README.

- `POST /owner-auth/login`: internal key + пароль, scrypt verification, 8-часовая сессия. PostgreSQL хранит только hash token; смена password hash отзывает все прежние сессии. `GET /admin/session` проверяет доступ, `POST /admin/logout` отзывает сессию.
- Все `/admin/*` защищены OwnerGuard. `GET /admin/dashboard?range=today|yesterday|7|30|90`, jobs/companies/sources/logs с пагинацией; POST/PATCH компаний/источников, PATCH job и status, POST job/reset, DELETE job, POST source/sync. Next BFF дополнительно проверяет Origin изменений; браузеру token не возвращается в JSON.
- `manualOverride` защищает от импорта отредактированные поля, `statusOverride` — явно выбранный статус. Reset снимает обе защиты для следующего импорта. Изменения job используют тот же advisory lock, что импорт; занятый источник возвращает 409 с предложением повторить. DeletedJob блокирует повторное появление удалённой записи. Disabled company скрывает её вакансии и исключает будущие sync.
- `POST /events` требует internal key и строгую схему: UUID, разрешённый публичный pathname, PAGE_VIEW/JOB_VIEW/APPLY_CLICK. Сервер проверяет соответствие вакансии и пути. Время задаёт сервер, UUID события обеспечивает идемпотентность. Raw IP, полный user-agent, полные referrer URL и query-параметры поиска не сохраняются; user-agent преобразуется в device/browser/OS. Географию передаёт только настроенный доверенный Next GeoProvider.
- SQL-отчёты используют UTC и уникальные анонимные visitor/session ID. CTR = Apply clicks / job views; это не число успешных заявок. Top CTR требует 5 просмотров. Период относится к аналитике, inventory — ко всем записям.
- Hourly worker удаляет события старше 90 дней, import logs старше 30 дней, истёкшие owner sessions; RUNNING старше часа получает INTERRUPTED. Будущая агрегация может заменить SQL за границей `analyticsReport`.
- Rate limits в памяти одного процесса: login 10/5 минут, события 2000/минуту глобально и 90/минуту на session, sync 20/минуту. Перед масштабированием API лимиты следует перенести в Redis. API не должен публиковать внутренний ключ.

E2E использует отдельную test DB и Redis DB 15, без рабочего worker. Не запускайте backend integration и frontend E2E одновременно.


### Данные центрального графика

`GET /admin/dashboard` дополнительно возвращает `chart` из `src/chart-analytics.ts`: `granularity`, `currentPeriod {start,end,metrics}`, `previousPeriod {start,end,available,metrics}`, `series [{timestamp,visitors,pageViews,jobViews,applyClicks,applyConversion,jobViewers,applyUsers,future,partial}]`. Один дополнительный SQL-запрос ограничен индексируемыми временными окнами; существующие KPI и таблицы не менялись.

Apply conversion использует пересечение уникальных job viewers и Apply users в том же временном окне / уникальных job viewers × 100. Повторные клики не увеличивают конверсию; события Apply без просмотра в окне остаются в счётчике кликов. При отсутствии job viewers конверсия `null`. Summary дедуплицируется за весь период, независимо от суммы дневных/часовых точек.

Today/Yesterday возвращают 24 почасовых слота, 7/30/90 — дневные. Будущие часы имеют `future`, текущий неполный интервал — `partial`. Сравнение сдвигает обе границы на 1/7/30/90 календарных дней UTC, сохраняя равную длительность; для Today это вчера до того же времени. Если предыдущий период выходит за 90-дневное хранение, `available=false`, `metrics=null`; отсутствующие исторические данные не выдаются за нулевые.
