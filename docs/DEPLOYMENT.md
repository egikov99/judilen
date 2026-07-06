# Docker и Portainer

## Локальный production

```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm migrator pnpm --filter @judilen/db seed
```

Compose запускает `migrate` как one-shot service, применяет миграции и
идемпотентный seed, а приложение поднимает только после их успешного завершения.

## Portainer

1. Создайте Stack из `docker-compose.yml` или подключите GitHub repository.
2. Передайте runtime secrets через Portainer environment/secrets.
3. Создайте webhook redeploy.
4. В GitHub repository settings добавьте Actions secret `PORTAINER_WEBHOOK_URL`.
5. Защитите ветки `dev` и `main`.

Portainer не должен создавать или монтировать `.env`. Перед первым запуском
one-shot сервис `secret-init` автоматически создаёт следующие значения в
persistent volume `runtime_secrets`:

| Секрет | Назначение |
|---|---|
| PostgreSQL password | Подключение `db`, `migrate` и `app` |
| Auth secret | Подпись пользовательских сессий и шифрование настроек |
| Notification cron secret | Авторизация фонового worker |
| Seed admin password | Пароль первого администратора |

Секреты создаются только при отсутствии соответствующего файла и не меняются
при restart/redeploy. Не удаляйте volume `runtime_secrets`: без сохранённого
пароля приложение потеряет доступ к существующему PostgreSQL volume.

Сгенерированный пароль администратора выводится один раз в логах контейнера
`secret-init`. Скопируйте его после первого deploy и смените после входа.

Ручные `POSTGRES_PASSWORD`, `AUTH_SECRET`, `NOTIFICATION_CRON_SECRET` и
`SEED_ADMIN_PASSWORD` в Environment variables Stack по-прежнему поддерживаются:
при первом запуске пустого `runtime_secrets` они сохраняются вместо
автоматически сгенерированных значений. Это также нужно при подключении уже
существующего PostgreSQL volume — перед первым запуском новой схемы передайте
его текущий пароль через `POSTGRES_PASSWORD`.

Для обычного Portainer Stack достаточно указать публичные настройки:
`APP_URL`, `NEXT_PUBLIC_SITE_URL`, `SEED_ADMIN_EMAIL` и
`SEED_ADMIN_RESET_PASSWORD=false`. Значения из GitHub Actions не передаются
webhook-запросом в Portainer.

One-shot service `migrate` последовательно применяет миграции и запускает
идемпотентный seed. При первом deploy он создаёт администратора из
`SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; при следующих deploy существующий
пароль не изменяется.

Для одноразового восстановления доступа установите в Portainer
`SEED_ADMIN_PASSWORD` в новый пароль и `SEED_ADMIN_RESET_PASSWORD=true`,
выполните redeploy и затем верните `SEED_ADMIN_RESET_PASSWORD=false`. Сервис
`secret-init` обновит только сохранённый seed-пароль, после чего seed установит
его администратору, активирует пользователя и гарантирует ему роль
администратора. Остальные persistent-секреты при этом не меняются.

`Dev CI` запускается для pull request в `dev` и push в `dev`; он выполняет проверки без деплоя. `Production` запускается только после push в `main`. Portainer webhook является последним шагом production job, поэтому он не вызывается при ошибке install, lint, typecheck, migration, seed, tests, Next.js build, Compose validation или Docker build.

## Ветки

- работа: `feature/*`;
- интеграция: PR в `dev`;
- production: после проверки `dev` создается PR `dev` → `main`;
- автоматических merge между ветками нет.

## Настройки GitHub

- Settings → Actions → General → Workflow permissions: **Read and write permissions**.
- Secret `PORTAINER_WEBHOOK_URL` должен быть добавлен в repository secrets или в environment `production`.
- Для `dev` требуется pull request и успешный check `Lint, typecheck, tests and build`.
- Для `main` требуется pull request из `dev`; проверенный SHA уже имеет успешный check `Lint, typecheck, tests and build` после push в `dev`.
- Production check выполняется после merge/push в `main` и блокирует деплой, а не сам merge.
- GitHub Actions не выполняет `git push`, поэтому bypass branch protection для workflow не нужен.

## Настройки Portainer

- Stack должен быть подключен к актуальному GitHub repository.
- Reference/branch для Stack: `main`.
- Compose path: `docker-compose.yml`.
- Webhook должен принадлежать именно этому Stack и выполнять pull/redeploy.
- На Docker endpoint должна существовать внешняя сеть `proxy`.
- Reverse proxy должен быть подключен к сети `proxy` и направлять трафик на `app:3000`.

Приложение не публикует порт на Docker host. Оно подключено к `proxy` для
reverse proxy и к внутренней сети Stack для доступа к PostgreSQL.

Фотографии хранятся в volume `uploads`, вложения чатов — в
`chat_attachments`, а финансовые чеки — в отдельном закрытом volume
`expense_receipts`. Документы бронирований хранятся в закрытом volume
`booking_documents`. Не удаляйте эти volumes при обычном redeploy.

## Production checklist

- TLS и secure headers на reverse proxy;
- длинные уникальные `AUTH_SECRET`, webhook secrets и DB credentials;
- закрытая PostgreSQL network;
- backup + проверка восстановления;
- S3-compatible object storage и антивирусная проверка загрузок;
- реальный payment adapter и проверка подписи webhook;
- SMTP/DKIM/SPF;
- централизованные logs, metrics и alerts.
