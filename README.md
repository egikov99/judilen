# Усадьба «Юдилен»

Production-oriented веб-платформа для аренды домиков: публичный SEO-сайт, личный кабинет гостя, CRM/админ-панель, бронирования, платежный контур и синхронизация календарей.

## Стек

- Next.js 16 / React 19 / TypeScript 6, SSR + SSG
- PostgreSQL 17, Drizzle ORM и SQL migrations
- JWT session в `HttpOnly` cookie, Argon2id, RBAC
- Zod для входных данных
- SMTP password-reset flow и абстракции платежей/каналов продаж
- Vitest и Playwright
- Docker / Docker Compose / GitHub Actions / Portainer webhook

## Быстрый запуск

Требуются Node.js 24+, pnpm 11+ и Docker.

```bash
cp .env.example .env
# При Docker-запуске runtime-секреты автоматически создаются в persistent volume
docker compose up -d db
pnpm install
pnpm db:migrate
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='replace-with-a-unique-strong-password-1' pnpm db:seed
pnpm dev
```

Сайт: `http://localhost:3000`. Админка: `http://localhost:3000/admin`.

Пароль seed-администратора необходимо сменить до публикации. Seed по умолчанию существует только для локальной разработки.

## Команды

```bash
pnpm dev          # development server
pnpm build        # production build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Структура

```text
apps/web/                 Next.js приложение и REST API
packages/auth/            сессии, роли, permissions, навигация по RBAC
packages/db/              schema, migration, seed
packages/integrations/    адаптеры каналов и рабочий iCal
design/stitch/            оригинальные HTML и полноразмерные PNG из Stitch
docs/                     архитектура, API и деплой
```

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `APP_URL` / `NEXT_PUBLIC_SITE_URL` | Канонический URL приложения |
| `DATABASE_URL` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | Необязательное ручное значение; Docker автоматически создаёт persistent-пароль |
| `AUTH_SECRET` | Ключ подписи сессии, минимум 32 символа |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Данные первого администратора; в Docker пароль может генерироваться автоматически |
| `SESSION_TTL_SECONDS` | Срок жизни сессии |
| `UPLOAD_DIR` / `MAX_UPLOAD_BYTES` | Persistent-каталог загрузок (в Docker `/app/storage/uploads`) и лимит размера |
| `ICAL_SYNC_CRON_SECRET` | Авторизация плановой iCal-синхронизации |
| `NOTIFICATION_CRON_SECRET` | Авторизация worker; в Docker генерируется автоматически |
| `PAYMENT_PROVIDER` | Выбранный платежный адаптер |
| `PAYMENT_WEBHOOK_SECRET` | Проверка webhook платежного провайдера |
| `SMTP_*` | Транзакционные письма |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Необязательная ручная настройка push; без ENV пара автоматически генерируется и хранится зашифрованной в PostgreSQL |
| `PORTAINER_WEBHOOK_URL` | Только GitHub Secret, не runtime env приложения |

Полный шаблон находится в [.env.example](./.env.example).

## Безопасность

- Пароли хешируются Argon2id.
- Сессия подписана и хранится в `HttpOnly`, `SameSite=Lax`, `Secure` cookie.
- Видимость CRM-разделов и backend endpoints проверяют permissions независимо.
- Все публичные payload проходят Zod.
- Пересекающиеся подтвержденные бронирования блокируются PostgreSQL `EXCLUDE USING gist`; это защищает и от конкурентных запросов.
- Важные изменения предназначены для записи в `audit_logs`.
- Секреты отсутствуют в репозитории.

Перед публичным запуском необходимо подключить реальный SMTP и платежного провайдера, настроить reverse proxy/TLS и резервные копии PostgreSQL. Локальные фото уже работают через Docker volume; при горизонтальном масштабировании замените его S3-compatible хранилищем.

## Документация

- [Архитектура](./docs/ARCHITECTURE.md)
- [REST API](./docs/API.md)
- [Docker и Portainer](./docs/DEPLOYMENT.md)
- [CI/CD и ветки](./docs/CI_CD.md)
- [Исходники Stitch](./design/stitch/README.md)
