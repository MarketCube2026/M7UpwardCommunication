#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"
set -a
. ./.env.server
set +a

mkdir -p backups
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
docker compose --env-file .env.server exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  | gzip > "backups/zhibi-$timestamp.sql.gz"
find backups -type f -name 'zhibi-*.sql.gz' -mtime +14 -delete

