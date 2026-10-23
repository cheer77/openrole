# vmiyou backend — Phase 5

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

Классификация профессий находится в `src/jobs/classification.ts`: конкретная должность имеет приоритет над тегами источника; слишком общая должность без достоверного тега остаётся `Other`. Тип занятости определяется только по явной формулировке источника; если указано несколько вариантов, единый тип не назначается. Уровень опыта выводится из явных слов в названии, без догадки по отрасли. `src/providers/normalize.ts` применяет классификацию при каждом импорте. Миграция `20261011030000_job_taxonomy_filters` добавляет `categoryVersion` и `employmentKind`. После миграции worker сам ставит задачу `reclassify-jobs` и небольшими пакетами обновляет старые вакансии из сохранённых title, sourceCategories и employmentType; вручную редактированные категорию и опыт не перезаписывает. Повторный запуск безопасен, внешние API при переклассификации не вызываются. В Railway примените `npm run db:migrate` к backend-базе **до** запуска новой версии API и worker; после запуска worker категории существующих вакансий начнут меняться без полного повторного импорта.

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
| USAJOBS | `public` | Official search API; `USAJOBS_API_KEY` and `USAJOBS_USER_AGENT` (email) on worker |
| ARBEITNOW | `all` | Public paginated Job Board API, no key |
| CANADA_JOB_BANK | `official-en` | Official monthly Open Data CSV; historical dataset is rejected until official data includes active status and real apply links |

Новый источник добавляется через `/admin/companies` → `/admin/sources` → **Add source**: выбрать компанию и провайдера, указать identifier, включить Enabled и нажать **Sync now**. Для Greenhouse укажите board token из URL `boards.greenhouse.io/TOKEN`; для Lever — site slug из `jobs.lever.co/SLUG` или `eu:SLUG` для EU. Для USAJOBS и Arbeitnow создайте одну служебную компанию-источник (например, USAJOBS/Arbeitnow) и фиксированный identifier; фактический работодатель каждой вакансии создаётся из API-данных. Greenhouse, Lever и Arbeitnow не требуют API-ключа. USAJOBS требует ключ только на backend/worker. Это импорт из сторонних API/фидов, а не endpoint приёма партнёрских вакансий. Для другого формата/API нужен отдельный `JobProvider`; вставка произвольного URL не создаёт адаптер автоматически.

`USAJOBS_API_KEY` и `USAJOBS_USER_AGENT` (email, использованный при регистрации ключа) добавьте в backend worker environment, не в Next/Vercel. Если CLI запускает worker локально, переменные должны быть в `backend/.env` процесса worker. Доступен полный поиск публично открытых федеральных вакансий, до 500 на страницу. Работа с API происходит только в worker. Не добавляйте ключ в source identifier или JSON-каталог.
Кнопка **Test connection** для USAJOBS ставит короткую проверку первой страницы в очередь worker; результат `TEST_SUCCESS`/`TEST_FAILED` и ошибка видны в Import logs. Полный **Sync now** сохраняет обычный лог импорта со счётчиками.

Arbeitnow читает `page=1`, затем следующие страницы только пока API отдаёт `links.next`. API может возвращать более 300 вакансий за страницу, поэтому provider допускает до 5000 элементов на страницу; общий лимит снимка — 50 000, а HTTP-ответа — 20 MB. Повторяющиеся `slug` между страницами пропускаются: смещение страниц может измениться во время импорта. Если следующая страница не принесла ни одной новой вакансии, снимок считается неудачным, чтобы не принять за полный повтор страницы. Неверная ссылка, пустая промежуточная страница или достижение лимита также считаются неудачным снимком; lifecycle не закрывает существующие вакансии. Повторный sync обновляет записи по `(sourceId, externalId)`. Между страницами выдерживается пауза 5 секунд; при HTTP 429/5xx источник остаётся включённым, а очередь делает до трёх попыток с экспоненциальной задержкой от 5 минут для Arbeitnow. При исчерпании попыток импорт остаётся FAILED и прежние вакансии не закрываются. Если источник уже был отключён после прежней ошибки, включите его в Admin → Sources и запустите Sync now один раз.

Canada Job Bank публикует [официальный набор месячных CSV](https://open.canada.ca/data/en/dataset/ea639e28-c0fc-48bf-b5dd-b8899bd43072). Worker при sync получает каталог ресурсов, выбирает последний англоязычный CSV, скачивает и разбирает его в фоне, с ограничением размера и проверкой колонок. В текущем официальном формате нет подтверждённого статуса активной вакансии, работодателя, полного описания, ссылки на объявление и ссылки для отклика. Поэтому provider завершает sync ошибкой и ничего не публикует/не закрывает: эти поля нельзя выдумывать, а месячный исторический CSV не является актуальным списком открытых вакансий. Новые CSV публикует владелец набора; следующий ручной или запланированный sync выбирает последнюю версию автоматически. Включать источник имеет смысл после появления официального фида с обязательными полями.

Логотип хранится на уровне Company и автоматически используется всеми её вакансиями. В owner-форме можно указать прямой `Logo URL`; он имеет приоритет. Если его нет, frontend запрашивает `/favicon.ico` официального Website. Каталог `sources.europe.json` содержит официальные сайты всех включённых компаний и отдельные icon URL там, где стандартный favicon отсутствует. Недоступное изображение заменяется понятной нейтральной иконкой, поэтому сломанное изображение пользователю не показывается.

`sources.europe.json` — каталог 32 включённых board-источников европейских и международных работодателей с присутствием в Европе (проверен 2026-10-08) и отдельный агрегированный Arbeitnow source. Он дополняет три начальных источника, не заменяя их. Импортируется весь публичный board, в том числе вакансии за пределами Европы. Количество позиций меняется, статических вакансий/счётчиков в каталоге нет. Фильтр Europe работает по фактическим данным вакансии; страна не выводится из адреса головного офиса. Доступность API не является подтверждением лицензии на перепубликацию: условия использования данных определяет работодатель/провайдер.

```sh
# Из backend/ после build и db:migrate:
npm run sources:import -- sources.europe.json
npm run sync
# Или из корня при Docker backend:
docker compose exec -T api node dist/src/cli.js sources sources.europe.json
docker compose exec -T api node dist/src/cli.js sync
```

Примеры в `sources.example.json` выключены по умолчанию. При запуске нового worker каталог `sources.europe.json` автоматически добавляет только отсутствующие включённые источники и ставит их на первый sync; существующие источники, включая выключенные владельцем, не меняются. Успешный первый sync помечает источник проверенным; ошибка выключает новый источник и показывает причину в Discovery. CLI выше остаётся для ручного импорта и запуска. Реальные вакансии не включены в seed. Чтобы поставить в очередь один источник: `npm run sync -- SOURCE_ID`. Worker должен работать, иначе задания остаются в Redis. В Docker CLI доступна через `docker compose exec api node dist/src/cli.js sync` (для JSON используйте файл внутри контейнера).

## API

`GET /health` проверяет PostgreSQL и возвращает 503 при недоступности.

`GET /jobs` возвращает `{ items, total, page, limit, pages, currency }`. В списке нет полного description; `GET /jobs/:slug` возвращает полную вакансию и компанию. Закрытые, скрытые и вакансии выключенных источников возвращают 404. При непустом `search` сортировка по умолчанию — `relevance`: PostgreSQL применяет действующие фильтры, затем ранжирует совпадения в названии, категории/технологиях, компании и описании, учитывая количество слов и свежесть при равном score. Без поиска по умолчанию остаётся `newest`; явный `sort` сохраняет приоритет пользователя. Миграции `20261013000000_job_search_relevance` и `20261013010000_job_search_short_terms` включают `pg_trgm`, trigram- и full-text GIN-индексы поисковых полей. Для локальной диагностики можно запустить backend с `NODE_ENV=development SEARCH_DEBUG=1`: score и его основные сигналы вакансий текущей страницы записываются в серверный лог, не в публичный ответ.

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
| `sort` | relevance (по умолчанию при search), newest (без search), oldest, salary-high, salary-low |
| `page`, `limit` | page 1–10000, limit 1–100 (по умолчанию 20) |

Пример: `GET /jobs?search=Frontend&remoteType=REMOTE&technologies=React&sort=newest&page=1&limit=20`.

`GET /companies?search=Stripe&page=1&limit=30&sort=featured` возвращает `{ items, total, page, limit, pages }`. В каждой компании `_count.jobs` — число публично доступных активных вакансий. Поиск по имени применяется ко всему каталогу до пагинации и не зависит от регистра. Сортировки: `featured` (явный список подтверждённых известных компаний с активными вакансиями, затем остальные; внутри групп — по числу вакансий), `activeJobs`, `name`, `nameDesc`. Старый default `name` сохранён для существующих клиентов, а страница `/companies` явно запрашивает `featured`. Компании без активных вакансий выключенных источников в выдачу не попадают.

Неверные и неизвестные query-параметры возвращают 400. Для `featured` общее количество и состав страницы вычисляются одним агрегирующим SQL-запросом; остальные сортировки используют существующие транзакции. Валюты не конвертируются. Неизвестная зарплата исключается из зарплатных фильтров/сортировки; при частичном диапазоне null сортируется последним.

## Импорт и защита данных

- Девять адаптеров реализуют `JobProvider`; `providers/http.ts` ограничивает сетевые ответы, `source-config.ts` проверяет provider-specific identifiers одинаково в CLI, admin и адаптерах. Canada Job Bank пока не публикует вакансии из-за отсутствия обязательных полей в официальном историческом наборе. Ошибка любой записи отклоняет снимок целиком, сохраняя предыдущие данные.
- Полные списки локаций сохраняются до 5000 символов (также в owner editor). Nullable `workplaceType`, `isRemote` и `address` в Ashby допустимы: отсутствующие сведения остаются неизвестными.
- Greenhouse проверяет `meta.total`, Lever читает все страницы (включая EU instance), Ashby импортирует только `isListed: true`. Ограничения: 20 MB на ответ, 20 секунд на запрос, максимум 20000 записей; достижение лимита Lever считается ошибкой, а не полным снимком.
- SmartRecruiters проверяет `offset`, стабильность `totalFound` и уникальность ID на всех страницах по 100; изменившаяся во время пагинации выдача перечитывается до трёх раз до передачи ошибки штатному BullMQ retry. Полные описания загружаются отдельно, последовательно, с паузой 250 ms между запросами; при двух worker jobs это не более 8 запросов/s суммарно. Неверный ID/компания, повреждённый detail и временная ошибка API отменяют снимок. Публикация, которая между list и detail исчезла с `404/410`, стала неактивной либо внутренней, исключается из публичного снимка без потери остальных вакансий. URL `ref` из ответа не используется для запросов. Импорт ограничен 30 минутами для больших boards; до записи удерживается только advisory lock, не блокирующий публичное чтение. Owner-редактирование вакансий этого источника в это время возвращает 409.
- Personio/Recruitee используют XML с проверкой синтаксиса/корневого элемента, запретом DOCTYPE/ENTITY и отключённым расширением entities. Фиксированные hosts и запрет redirects исключают произвольные запросы из identifier. Пустой валидный корень — пустой снимок, HTML/error payload не считается пустым board. Стандартные XML entities декодируются без DTD. Personio `createdAt` не подставляется как дата публикации; Recruitee использует `published_at`. Recruitee выбран именно XML: объявленное требование токена для Careers JSON API с 10 февраля 2027 не относится к XML feed.
- Greenhouse HTML, закодированный сущностями несколько раз, ограниченно декодируется перед выделением текста и разметки; frontend всё равно очищает разметку перед показом. Для непрозрачных board tokens provider берёт человекочитаемое имя из официального Greenhouse board API, если оно доступно. Проверенный HelloFresh Alumni board `4lu44n1n37w012k` связывается с HelloFresh. Страна берётся из структурированного поля, явного окончания location или однозначного региона (например, Saxony-Anhalt → DE); неопределённая страна остаётся пустой. Повторный sync обновляет уже импортированные вакансии.
- Внешний HTML преобразуется в текст. API не выдаёт HTML для прямой вставки. Категория и явно указанная старшинство определяются по заголовку; неподтверждённые значения остаются Other/null. Remote/Hybrid берутся из структурного поля либо явного указания в location. География из описания не угадывается.
- Сравниваются только структурированные годовые зарплаты. Часовые ставки, бонусы и equity не превращаются в годовые суммы. Неизвестные поля остаются null.
- Дедупликация — уникальный `(sourceId, externalId)`; slug создаётся один раз с устойчивым хешем и сохраняется при переименовании. Cross-source fuzzy matching отсутствует.
- `publishedAt` — дата публикации источника, `sourceUpdatedAt` — дата изменения источника, если доступна, `firstSeenAt` — первое обнаружение, `lastCheckedAt` — последнее подтверждение присутствия. `sortDate` равен publishedAt, иначе firstSeenAt. Greenhouse `updated_at` хранится отдельно и не выдаётся за публикацию. Структурированные категории источника сохраняются отдельно от единой категории платформы. Повторный импорт не делает старые вакансии свежими.
- `contentUpdatedAt` меняется только при создании вакансии или подтверждённом изменении публичного содержимого/статуса; `lastSeenAt`, `lastCheckedAt`, missing counters и `sourceUpdatedAt` сами по себе его не меняют. Миграция `20261020000000_job_seo_content_updated` оставляет дату старых строк пустой, потому что прежний `updatedAt` смешивал содержательные и технические записи. Она безопасно backfill-ит только уже сохранённую структурированную географию. `/seo/jobs` и `/seo/companies` используют эту дату для sitemap `lastmod`; при неизвестной дате поле отсутствует.
- `structuredLocations` хранит только подтверждённые provider-поля country/city/region. USAJOBS сохраняет все структурированные локации (до 100), остальные адаптеры — доступные надёжные адресные поля. JobPosting создаётся только для ACTIVE с настоящим `publishedAt`, полным описанием, работодателем и допустимой географией. Для полностью remote вакансии используются `TELECOMMUTE` и явные страны `applicantLocationRequirements`; `firstSeenAt` и provider `updated_at` не подставляются как `datePosted`.
- Отсутствие вакансии в полном успешном снимке задаёт `missingSince` и увеличивает `missingCount`. Закрытие происходит после трёх успешных пропусков не менее чем за 24 часа. Это применяется и к пустому board. HTTP-ошибка, timeout, дубликаты ID и неверная структура не закрывают вакансии. CLOSED очищаются через 30 дней после `closedAt`; повторное появление автоматически закрытой вакансии возвращает ACTIVE и прежний URL. HIDDEN и ручной CLOSED не раскрываются автоматически.
- Ежедневная очистка удаляет CLOSED пакетами с блокировкой строк и сохраняет `ExpiredJob` с прежним ID, slug, source/externalId и названием. `AnalyticsEvent` остаются по старому jobId; GET/HEAD API удалённого URL отдают 410. Публичный `/companies` показывает включённых работодателей, у которых есть ACTIVE-вакансии из любого включённого Source, в том числе агрегированного; наличие собственного Source у работодателя не требуется. Публичные `/seo/summary`, `/seo/jobs`, `/seo/companies` отдают только видимые ACTIVE записи; компании попадают в sitemap от 5 активных вакансий. `/jobs/:slug/similar` возвращает до 6 похожих вакансий, `/companies/:slug` — профиль и счётчики.
- Весь импорт одного источника атомарен. PostgreSQL advisory lock исключает одновременную обработку источника; BullMQ deduplication исключает повторную постановку активного задания. Интервал общего BullMQ scheduler хранится в PostgreSQL и управляется из Admin → System: 1/3/6/12/24 часа, по умолчанию 12. Автоматический и ручной глобальные запуски используют одну очередь и единый `SyncRun`; транзакционная advisory lock не допускает двух активных глобальных запусков. Worker обрабатывает не более двух заданий одновременно и делает три попытки с exponential backoff.
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
- Все `/admin/*` защищены OwnerGuard. `GET /admin/dashboard?range=today|yesterday|7|30|90`, jobs/companies/sources/logs с пагинацией; POST/PATCH компаний/источников, PATCH job и status, POST job/reset, DELETE job, POST source/sync. `GET /admin/sync` возвращает сохранённую конфигурацию и фактическое состояние BullMQ, `PATCH /admin/sync` принимает `enabled`, `intervalHours` и optimistic-lock `revision`. Next BFF дополнительно проверяет Origin изменений; браузеру token не возвращается в JSON.
- `manualOverride` защищает от импорта отредактированные поля, `statusOverride` — явно выбранный статус. Reset снимает обе защиты для следующего импорта. Изменения job используют тот же advisory lock, что импорт; занятый источник возвращает 409 с предложением повторить. DeletedJob блокирует повторное появление удалённой записи. Disabled company скрывает её вакансии и исключает будущие sync.
- `POST /events` требует internal key и строгую схему: UUID, разрешённый публичный pathname, PAGE_VIEW/JOB_VIEW/APPLY_CLICK. Сервер проверяет соответствие вакансии и пути. Время задаёт сервер, UUID события обеспечивает идемпотентность. Raw IP, полный user-agent, полные referrer URL и query-параметры поиска не сохраняются; user-agent преобразуется в device/browser/OS. Географию передаёт только настроенный доверенный Next GeoProvider.
- SQL-отчёты используют UTC и уникальные анонимные visitor/session ID. CTR = Apply clicks / job views; это не число успешных заявок. Top CTR требует 5 просмотров. Период относится к аналитике, inventory — ко всем записям.
- При запуске и затем каждый час worker удаляет события старше 90 дней, import logs старше 30 дней и истёкшие owner sessions; RUNNING старше часа получает INTERRUPTED. Поэтому запись импорта, оставшаяся после аварийной остановки worker или базы, исправляется сразу после следующего запуска worker. Будущая агрегация может заменить SQL за границей `analyticsReport`.
- Rate limits в памяти одного процесса: login 10/5 минут, события 2000/минуту глобально и 90/минуту на session, sync 20/минуту. Перед масштабированием API лимиты следует перенести в Redis. API не должен публиковать внутренний ключ.

Конфигурация автоматической синхронизации хранится singleton-строкой `VacancySyncConfig`. `revision` защищает конкурентные изменения владельца, `appliedRevision` отличает сохранённое состояние от применённого в Redis, `lastApplyError` сохраняет частичный сбой. PATCH сначала атомарно сохраняет новую revision и рассчитывает `nextRunAt` от времени сохранения, затем под row lock применяет единственный scheduler с прежним ID `hourly`. Отключение удаляет только следующий повторяющийся job и не затрагивает active jobs. Worker сверяет PostgreSQL и BullMQ при старте и раз в пять минут как редкую страховку после временной недоступности Redis; несколько Worker сериализуются той же блокировкой строки. При первом деплое совместимое существующее 12-часовое расписание принимается без переноса ближайшего запуска.

`POST /admin/sync/run` создаёт ручной `SyncRun`, если нет другого `QUEUED`/`RUNNING` запуска; конфликт возвращает 409. `GET /admin/sync/runs` и `GET /admin/sync/runs/:id` отдают историю и результаты каждого источника. `SyncRunSource` связывает source job с `ImportLog`, поэтому итоговые created/updated/closed считаются из фактических результатов, а не из факта постановки в очередь. После аварийного завершения worker незавершённые более 24 часов запуски получают `INTERRUPTED` при старте или редкой сверке. Отключённый scheduler не запрещает явный ручной запуск.

E2E использует отдельную test DB и Redis DB 15, без рабочего worker. Не запускайте backend integration и frontend E2E одновременно.


### Данные центрального графика

`GET /admin/dashboard` дополнительно возвращает `chart` из `src/chart-analytics.ts`: `granularity`, `currentPeriod {start,end,metrics}`, `previousPeriod {start,end,available,metrics}`, `series [{timestamp,visitors,pageViews,jobViews,applyClicks,applyConversion,jobViewers,applyUsers,future,partial}]`. Один дополнительный SQL-запрос ограничен индексируемыми временными окнами; существующие KPI и таблицы не менялись.

Apply conversion использует пересечение уникальных job viewers и Apply users в том же временном окне / уникальных job viewers × 100. Повторные клики не увеличивают конверсию; события Apply без просмотра в окне остаются в счётчике кликов. При отсутствии job viewers конверсия `null`. Summary дедуплицируется за весь период, независимо от суммы дневных/часовых точек.

Today/Yesterday возвращают 24 почасовых слота, 7/30/90 — дневные. Будущие часы имеют `future`, текущий неполный интервал — `partial`. Сравнение сдвигает обе границы на 1/7/30/90 календарных дней UTC, сохраняя равную длительность; для Today это вчера до того же времени. Если предыдущий период выходит за 90-дневное хранение, `available=false`, `metrics=null`; отсутствующие исторические данные не выдаются за нулевые.

## Автоматическое обнаружение компаний и ATS

`company-discovery` работает только в BullMQ worker. После каждого успешного импорта worker ставит новые компании из вакансий в очередь; ежедневный `discover-all` также добавляет компании из `sources.europe.json` и просматривает необработанные записи. Сначала используются прямые ATS-ссылки отклика уже импортированных вакансий, затем известная career page или сайт компании. Компания сопоставляется по домену сайта и нормализованному имени; имя без подтверждённой ссылки не превращается в угаданный URL и попадает на ручную проверку. Поля `discoveredFrom`, `discoveredAt`, `discoveryStatus`, `lastDiscoveryAt`, `discoveryAttempts` и `nextRetryAt` сохраняются в `Company`.

Для известного сайта выполняется не более двух HTML-запросов (главная и выбранная career page), с ограничением двух redirects на каждый, таймаутом 8 секунд, размером 512 KB и запретом private/local адресов. URL и ссылки распознаются для Greenhouse, Lever, Ashby, Personio и Recruitee. Только однозначное HIGH совпадение создаёт disabled Source; полная загрузка board служит проверкой соединения, после чего Source включается и выполняется начальный sync. Ошибка оставляет Source disabled и причину в Admin → Discovery. MEDIUM/LOW/UNKNOWN ожидают решения владельца. Повторная попытка после сетевой ошибки выполняется с паузами 1/2/4 дня, затем запись остаётся на review. Общий лимит worker — 2 одновременных задачи. Поиск вакансий не делает внешних запросов.

Admin → Discovery (`GET /admin/discovery`) показывает метрики и очередь с фильтром по статусу; `POST /admin/discovery/:id/:action` поддерживает `approve`, `reject`, `retry`, `create-source`, `ignore`. Approve повторно проверяет ATS и board до включения. Create Source оставляет его выключенным для ручной проверки в Sources. Миграция `20261011020000_company_discovery` обязательна перед запуском новой версии worker/API.
