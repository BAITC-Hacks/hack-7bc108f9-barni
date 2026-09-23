#!/usr/bin/env bash
# Smoke test against a running stack: docker compose up -d --build && scripts/smoke_test.sh
# Requires curl and jq.
set -euo pipefail

API="${API_URL:-http://localhost:8000}"

# call METHOD PATH EXPECTED_STATUS [JSON_BODY] -> prints response body, fails on status mismatch
call() {
  local method=$1 path=$2 expected=$3 body=${4:-}
  local out status
  out=$(mktemp)
  if [[ -n "$body" ]]; then
    status=$(curl -s -o "$out" -w '%{http_code}' -X "$method" "$API$path" \
      -H 'Content-Type: application/json' -d "$body")
  else
    status=$(curl -s -o "$out" -w '%{http_code}' -X "$method" "$API$path")
  fi
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL $method $path: expected $expected, got $status: $(cat "$out")" >&2
    rm -f "$out"
    exit 1
  fi
  cat "$out"
  rm -f "$out"
}

step() { echo "== $*"; }

for i in $(seq 1 30); do
  curl -sf "$API/health" >/dev/null && break
  [[ $i == 30 ]] && { echo "FAIL backend not reachable at $API" >&2; exit 1; }
  sleep 1
done

step "health"
call GET /health 200 | jq -e '.status == "ok"' >/dev/null

step "meta: 6 topics, 4 readiness levels"
call GET /api/meta 200 | jq -e '(.topics | length) == 6 and (.readiness_levels | length) == 4' >/dev/null

step "teams: demo profiles exist"
TEAM_ID=$(call GET /api/teams 200 | jq -er '.[0].id')
echo "team_id=$TEAM_ID"

step "create task"
TASK=$(call POST /api/tasks 201 '{"draft_text":"Хотим улучшить обработку заявок клиентов","topic":"automation"}')
TASK_ID=$(echo "$TASK" | jq -er '.id')
echo "$TASK" | jq -e '.status == "draft" and .score == null and .card.topic == "automation" and .confirmed_at == null' >/dev/null
echo "task_id=$TASK_ID"

step "get task"
call GET "/api/tasks/$TASK_ID" 200 | jq -e --arg id "$TASK_ID" '.id == $id' >/dev/null

step "errors use {error:{code,message}}"
call GET /api/tasks/00000000-0000-0000-0000-000000000000 404 | jq -e '.error.code == "TASK_NOT_FOUND"' >/dev/null
call POST /api/tasks 422 '{"draft_text":"x","topic":"unknown"}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null

# TODO: confirm (partial card) -> publish -> catalog -> confirm (full card) ->
# position changed -> proposal -> PATCH accepted. Blocked until
# rating_service.calculate_score lands in main.

echo "OK"
