#!/usr/bin/env bash
# Resets demo data: deletes all tasks and proposals, keeps teams, reloads data/seed.json.
# Needs a running stack (docker compose up -d). Does not remove volumes.
set -euo pipefail

cd "$(dirname "$0")/.."
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-hackalem}"

echo "== delete tasks and proposals"
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$DB_USER" -d "$DB_NAME" \
  -c "TRUNCATE proposals, tasks"

echo "== load seed"
docker compose exec -T backend python -m app.seed

echo "== catalog"
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -At -F ' | ' \
  -c "SELECT score, readiness_level, title FROM tasks WHERE status = 'published' ORDER BY score DESC, published_at DESC"
