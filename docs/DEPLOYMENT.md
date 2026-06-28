# Docker и Portainer

## Локальный production

```bash
cp .env.example .env
docker compose up -d --build
docker compose run --rm migrator pnpm --filter @judilen/db seed
```

Compose запускает `migrate` как one-shot service и поднимает приложение только после успешных миграций. Seed запускается вручную и не является частью production startup.

## Portainer

1. Создайте Stack из `docker-compose.yml` или подключите GitHub repository.
2. Передайте runtime secrets через Portainer environment/secrets.
3. Создайте webhook redeploy.
4. В GitHub repository settings добавьте Actions secret `PORTAINER_WEBHOOK_URL`.
5. Защитите ветки `dev` и `main`.

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

## Production checklist

- TLS и secure headers на reverse proxy;
- длинные уникальные `AUTH_SECRET`, webhook secrets и DB credentials;
- закрытая PostgreSQL network;
- backup + проверка восстановления;
- S3-compatible object storage и антивирусная проверка загрузок;
- реальный payment adapter и проверка подписи webhook;
- SMTP/DKIM/SPF;
- централизованные logs, metrics и alerts.
