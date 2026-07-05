#!/bin/sh
set -eu

secret_dir="${RUNTIME_SECRET_DIR:-/run/runtime-secrets}"

read_secret() {
  path="$secret_dir/$1"
  if [ ! -s "$path" ]; then
    echo "Required runtime secret is missing: $1" >&2
    exit 1
  fi
  cat "$path"
}

profile="${RUNTIME_SECRET_PROFILE:-app}"
case "$profile" in
  app)
    postgres_password="$(read_secret postgres_password)"
    export DATABASE_URL="postgres://judilen:${postgres_password}@db:5432/judilen"
    export AUTH_SECRET="$(read_secret auth_secret)"
    export NOTIFICATION_CRON_SECRET="$(read_secret notification_cron_secret)"
    ;;
  migrator)
    postgres_password="$(read_secret postgres_password)"
    export DATABASE_URL="postgres://judilen:${postgres_password}@db:5432/judilen"
    export SEED_ADMIN_PASSWORD="$(read_secret seed_admin_password)"
    ;;
  notification-worker)
    export NOTIFICATION_CRON_SECRET="$(read_secret notification_cron_secret)"
    ;;
  *)
    echo "Unknown RUNTIME_SECRET_PROFILE: $profile" >&2
    exit 1
    ;;
esac

exec "$@"
