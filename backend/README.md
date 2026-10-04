# Openrole backend — Phase 2

NestJS 12 (ESM), PostgreSQL 17, Prisma 7, Redis 7, BullMQ. Backend — отдельный npm-пакет. В Phase 3 frontend подключён к API через сервер Next.js (`API_URL`); mock-данные используются только в изолированных тестах. Пользовательская авторизация, OAuth, кабинеты и admin API пока не реализованы.

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

Публичных изменяющих API пока нет. Компании и источники конфигурируются локальной CLI:

```sh
cp sources.example.json sources.local.json
# У нужных источников установите enabled: true, проверьте company и sourceIdentifier.
npm run sources:import -- sources.local.json
npm run sync
```

Повторный импорт конфигурации обновляет существующие записи, не создавая дубликатов. Источник закреплён за одной компанией. `enabled: false` исключает его из синхронизации и публичной выдачи; отсутствие источника в JSON не удаляет его. `MANUAL` поддерживается в модели, но автоматически не импортируется. Greenhouse/Ashby принимают имя публичного board, Lever — имя сайта; для европейского Lever используйте `eu:company`. Произвольный URL как identifier не принимается.

Примеры в репозитории выключены по умолчанию, реальные вакансии не включены в seed. Чтобы поставить в очередь один источник: `npm run sync -- SOURCE_ID`. Worker должен работать, иначе задания остаются в Redis. В Docker CLI доступна через `docker compose exec api node dist/src/cli.js sync` (для JSON используйте файл внутри контейнера).

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

- Три адаптера реализуют `JobProvider`; сетевые ответы проходят проверку формы, нормализацию и общую валидацию. Ошибка любой записи отклоняет снимок целиком, сохраняя предыдущие данные.
- Greenhouse проверяет `meta.total`, Lever читает все страницы (включая EU instance), Ashby импортирует только `isListed: true`. Ограничения: 20 MB на ответ, 20 секунд на запрос, максимум 20000 записей; достижение лимита Lever считается ошибкой, а не полным снимком.
- Внешний HTML преобразуется в текст. API не выдаёт HTML для прямой вставки. Категория и явно указанная старшинство определяются по заголовку; неподтверждённые значения остаются Other/null. Remote/Hybrid берутся из структурного поля либо явного указания в location. География из описания не угадывается.
- Сравниваются только структурированные годовые зарплаты. Часовые ставки, бонусы и equity не превращаются в годовые суммы. Неизвестные поля остаются null.
- Дедупликация — уникальный `(sourceId, externalId)`; slug создаётся один раз с устойчивым хешем и сохраняется при переименовании. Cross-source fuzzy matching отсутствует.
- `publishedAt` — дата источника, `firstSeenAt` — первое обнаружение, `lastCheckedAt` — последнее подтверждение присутствия. `sortDate` равен publishedAt, иначе firstSeenAt. Greenhouse `updated_at` не выдаётся за публикацию. Повторный импорт не делает старые вакансии свежими.
- Отсутствие вакансии в полном успешном снимке задаёт `missingSince`. Закрытие происходит после повторного подтверждения минимум через 24 часа. Это применяется и к пустому board. HTTP-ошибка, timeout, дубликаты ID и неверная структура не закрывают вакансии. CLOSED сохраняются; повторное появление возвращает ACTIVE. HIDDEN не раскрываются автоматически.
- Весь импорт одного источника атомарен. PostgreSQL advisory lock исключает одновременную обработку источника; BullMQ deduplication исключает повторную постановку активного задания. Worker запускает общий scheduler раз в час, обрабатывает не более двух заданий одновременно, делает три попытки с exponential backoff.
- Последняя попытка, успешная синхронизация и ошибка доступны в Source. Структурированные сообщения worker содержат created/updated/closed. Redis хранит последние 100 завершённых и 200 неуспешных заданий. Admin UI и исторические import logs относятся к следующим фазам.

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

`TEST_DATABASE_URL` задаётся в `.env`; тест не допускает имя обычной базы и очищает только созданные им записи. Проверяются импорт/повторный импорт, сохранение дат и slug, ошибки источника, закрытие/повторное открытие, HIDDEN, отключение источника, реальные HTTP-ответы и query validation.

Prisma Client генерируется при build и не хранится в git. Миграции хранятся в git и применяются через `migrate deploy`. Зафиксированы overrides для исправленных `deepmerge-ts` и `mysql2`, используемых Prisma CLI; совместимость проверяется генерацией клиента и миграциями.

Официальные спецификации: [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Lever Postings API](https://github.com/lever/postings-api), [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api), [BullMQ schedulers](https://docs.bullmq.io/guide/job-schedulers).
