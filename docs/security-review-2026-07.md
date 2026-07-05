# Security review — 2026-07

## Исправлено

- Все `admin` API проверяются через RBAC, все `account` API — через server-side session.
- Owner-фильтры применяются к бронированиям, оплатам, профилю и сообщениям клиента.
- Устранена выдача `passwordHash`, raw webhook payload, push endpoint/keys, calendar raw payload и integration config в API DTO.
- Read-only staff больше не получает import/export URL календарей и сообщения каналов без `chats.read`.
- Добавлена защита от повышения роли и назначения прав выше прав текущего администратора.
- Logout и password reset увеличивают `sessionVersion`; production cookie использует префикс `__Host-`.
- Добавлен PostgreSQL rate limit для auth, reset, бронирований, чатов, SMTP, uploads, push и webhooks.
- CSRF-защита проверяет `Origin` для изменяющих cookie-auth запросов.
- SMTP и iCal защищены от private/reserved IP, внутренних hostname, redirect и DNS rebinding; SMTP-порты ограничены.
- Webhook signatures обязательны для поддерживаемых провайдеров; payload ограничен по размеру, replay сообщений блокируется unique ID.
- Webhook URL больше не содержит `webhook_secret`; новый URL использует публичный UUID канала.
- Upload проверяет MIME и magic bytes, запрещает SVG/HTML/JS, генерирует UUID filename, ограничивает размер/пакет и удаляет EXIF/XMP/text metadata.
- Приватные chat attachments требуют `chats.read`, имеют `no-store` и path traversal guard.
- JSON-LD экранируется; пользовательские тексты выводятся React как text, без raw HTML.
- Добавлены CSP, HSTS, `frame-ancestors`, COOP, `nosniff`, Referrer-Policy и Permissions-Policy.
- Приватные страницы/API получают `no-store` и `noindex`; sitemap не содержит приватных URL.
- VAPID private key и SMTP password не возвращаются; SMTP username маскируется.
- Production Compose больше не запускается с default-паролями БД, admin, JWT и cron.

## Эксплуатационные требования

- Перед deployment выполнить миграцию `0018_security_hardening.sql`.
- Обязательно задать `POSTGRES_PASSWORD`, `SEED_ADMIN_PASSWORD`, `AUTH_SECRET` и `NOTIFICATION_CRON_SECRET`.
- `COMMUNICATION_ENCRYPTION_KEY` или `AUTH_SECRET` должен оставаться стабильным, иначе зашифрованные настройки нельзя расшифровать.
- Reverse proxy должен перезаписывать, а не дополнять пользовательские `X-Forwarded-For`/`X-Real-IP`.
- Доступ к PostgreSQL backups и server logs должен быть ограничен как к персональным данным.

## Остаточные проверки deployment

- Проверить сценарии client A/client B на production-like PostgreSQL после миграции.
- Проверить CSP и push/service worker через реальный HTTPS-домен.
- Проверить подписи каждого подключённого provider webhook реальными запросами.
- Провести ротацию всех секретов, которые ранее могли использовать небезопасные default-значения.
