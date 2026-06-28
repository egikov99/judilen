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
5. Защитите ветки `dev` и `production`.

Workflow запускает lint, typecheck, tests, production build и Docker build. Job `deploy` имеет `needs: verify`, условие `push` в `dev` и `curl -f`, поэтому webhook не вызывается при любой неуспешной проверке.

## Ветки

- работа: `feature/*` или `codex/*`;
- интеграция: PR в `dev`;
- production: PR `dev` → `production`.

## Production checklist

- TLS и secure headers на reverse proxy;
- длинные уникальные `AUTH_SECRET`, webhook secrets и DB credentials;
- закрытая PostgreSQL network;
- backup + проверка восстановления;
- S3-compatible object storage и антивирусная проверка загрузок;
- реальный payment adapter и проверка подписи webhook;
- SMTP/DKIM/SPF;
- централизованные logs, metrics и alerts.
