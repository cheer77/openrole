# Правила работы с проектом

## Документация дизайна

При каждом изменении дизайна, UI/UX, стилей, добавлении нового компонента или редизайне существующего обязательно обновляй `styles/README.md` в рамках той же задачи.

Документ должен описывать актуальное состояние: назначение компонентов и файлов стилей, переменные, правила оформления, адаптивность и порядок подключения. Переписывай устаревшие разделы, добавляй новые сведения и удаляй неактуальные; не ограничивайся записью в журнале изменений.

Перед завершением задачи проверь соответствие `styles/README.md` внесённым изменениям.

## Границы текущей фазы

Phase 3 разрешена явной командой пользователя `START PHASE 3`. Текущий объём: интеграция frontend с API, серверный поиск/фильтры/сортировка/пагинация, загрузка, ошибки и пустые состояния. Дизайн сохраняется. Не начинай Phase 4 (admin и аналитика) без явной команды пользователя; авторизация и кабинеты остаются UI-прототипами.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
