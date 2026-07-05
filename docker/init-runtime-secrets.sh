#!/bin/sh
set -eu

secret_dir="${RUNTIME_SECRET_DIR:-/run/runtime-secrets}"
mkdir -p "$secret_dir"
chmod 711 "$secret_dir"

random_hex() {
  od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
}

ensure_secret() {
  name="$1"
  supplied_value="$2"
  prefix="$3"
  path="$secret_dir/$name"

  if [ -s "$path" ]; then
    return
  fi

  if [ -n "$supplied_value" ]; then
    value="$supplied_value"
  else
    value="${prefix}$(random_hex)"
  fi

  umask 022
  printf '%s' "$value" > "$path"
  chmod 444 "$path"
}

admin_password_path="$secret_dir/seed_admin_password"
admin_password_was_missing=false
if [ ! -s "$admin_password_path" ]; then
  admin_password_was_missing=true
fi

ensure_secret "postgres_password" "${POSTGRES_PASSWORD:-}" "Pg1-"
ensure_secret "auth_secret" "${AUTH_SECRET:-}" "Auth1-"
ensure_secret "notification_cron_secret" "${NOTIFICATION_CRON_SECRET:-}" "Cron1-"
ensure_secret "seed_admin_password" "${SEED_ADMIN_PASSWORD:-}" "Adm1-"

echo "Runtime secrets are ready in persistent storage"
if [ "$admin_password_was_missing" = "true" ] && [ -z "${SEED_ADMIN_PASSWORD:-}" ]; then
  echo "Generated initial administrator password (shown only on first creation):"
  cat "$admin_password_path"
  echo
fi
