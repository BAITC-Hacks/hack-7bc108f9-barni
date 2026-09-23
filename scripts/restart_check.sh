#!/usr/bin/env bash
# AC-15: data survives a container restart. Needs a running stack, curl and jq.
# Runs smoke_test.sh to create a published task with decided proposals,
# restarts all containers, then checks the same records are still there.
set -euo pipefail

cd "$(dirname "$0")/.."
API="${API_URL:-http://localhost:8000}"
STATE=$(mktemp)
trap 'rm -f "$STATE"' EXIT

echo "== create data via smoke_test.sh"
SMOKE_STATE_FILE="$STATE" scripts/smoke_test.sh >/dev/null
# shellcheck disable=SC1090
source "$STATE"
echo "task=$DEMO accepted=$P_ALPHA rejected=$P_BETA"

echo "== docker compose restart"
docker compose restart >/dev/null 2>&1
for i in $(seq 1 60); do
  curl -sf "$API/health" >/dev/null && break
  [[ $i == 60 ]] && { echo "FAIL backend did not come back at $API" >&2; exit 1; }
  sleep 1
done

echo "== published task is still in the catalog with its score"
curl -sf "$API/api/tasks/$DEMO" \
  | jq -e '.status == "published" and .score == 100 and .published_at != null and .confirmed_at != null and .proposals_count == 2' >/dev/null \
  || { echo "FAIL task $DEMO changed after restart" >&2; exit 1; }
curl -sf "$API/api/tasks" | jq -e --arg id "$DEMO" 'any(.[]; .id == $id)' >/dev/null \
  || { echo "FAIL task $DEMO missing from catalog" >&2; exit 1; }

echo "== proposal decisions are still in place"
curl -sf "$API/api/tasks/$DEMO/proposals" \
  | jq -e --arg a "$P_ALPHA" --arg b "$P_BETA" \
    '[.[] | {(.id): .status}] | add | .[$a] == "accepted" and .[$b] == "rejected"' >/dev/null \
  || { echo "FAIL proposal statuses changed after restart" >&2; exit 1; }

echo "OK"
