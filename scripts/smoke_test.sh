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
call GET "/api/tasks/$TASK_ID" 200 | jq -e --arg id "$TASK_ID" '.id == $id and .proposals_count == 0' >/dev/null

step "errors use {error:{code,message}}"
call GET /api/tasks/00000000-0000-0000-0000-000000000000 404 | jq -e '.error.code == "TASK_NOT_FOUND"' >/dev/null
call POST /api/tasks 422 '{"draft_text":"x","topic":"unknown"}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null

PARTIAL_CARD='{"title":"Оптимизация обработки заявок","topic":"automation","context":"Заявки приходят в WhatsApp и обрабатываются вручную","need":"Сократить время обработки заявок","data":"","users":"  ","constraints":null,"expected_result":null,"success_criteria":null,"contact":null,"interaction_format":null}'
FULL_CARD='{"title":"Оптимизация обработки заявок","topic":"automation","context":"Заявки приходят в WhatsApp и обрабатываются вручную","need":"Сократить время обработки заявок","users":"Операторы службы поддержки","data":"Выгрузка заявок за 3 месяца в CSV","constraints":"2 недели, Python","expected_result":"Прототип бота для заявок","success_criteria":"Время ответа меньше 5 минут","contact":"@manager","interaction_format":"Созвон раз в неделю"}'

step "rating preview: partial card = 20, nothing saved"
call POST /api/rating/preview 200 "{\"card\":$PARTIAL_CARD}" \
  | jq -e '.score == 20 and .readiness_level == "draft" and ([.breakdown[].earned] | add) == .score' >/dev/null
call GET "/api/tasks/$TASK_ID" 200 | jq -e '.score == null and .confirmed_at == null' >/dev/null

step "confirm partial card: blank strings -> null, score 20"
call PUT "/api/tasks/$TASK_ID/confirm" 200 "{\"card\":$PARTIAL_CARD}" \
  | jq -e '.score == 20 and .readiness_level == "draft" and .confirmed_at != null
           and .card.data == null and .card.users == null and .title == "Оптимизация обработки заявок"
           and ([.score_breakdown[].earned] | add) == .score and (.missing_fields | length) == 7' >/dev/null

step "confirm full card: score 100, priority"
call PUT "/api/tasks/$TASK_ID/confirm" 200 "{\"card\":$FULL_CARD}" \
  | jq -e '.score == 100 and .readiness_level == "priority" and (.missing_fields | length) == 0' >/dev/null

step "confirm validation: unknown topic and extra field -> 422"
call PUT "/api/tasks/$TASK_ID/confirm" 422 '{"card":{"topic":"Автоматизация"}}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null
call PUT "/api/tasks/$TASK_ID/confirm" 422 '{"card":{"budget":"1000"}}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null

step "ai analyze-draft: source present, topic must be a slug"
call POST /api/ai/analyze-draft 200 '{"draft":"Хотим улучшить обработку заявок клиентов","topic":"automation"}' \
  | jq -e '(.source == "model" or .source == "fallback") and (.questions | length) >= 3' >/dev/null
call POST /api/ai/analyze-draft 422 '{"draft":"x","topic":"Автоматизация"}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null
call POST /api/ai/analyze-draft 422 '{}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null

step "ai build-card: 200 with source=model, or 503 AI_UNAVAILABLE without a key"
BUILD_STATUS=$(curl -s -o /tmp/smoke_build.json -w '%{http_code}' -X POST "$API/api/ai/build-card" \
  -H 'Content-Type: application/json' \
  -d '{"draft":"Хотим улучшить обработку заявок клиентов","topic":"automation","questions":[{"id":"q1","target_field":"context","text":"Как сейчас обрабатываются заявки?"}],"answers":[{"question_id":"q1","answer":"Заявки приходят в WhatsApp и обрабатываются вручную"}]}')
case "$BUILD_STATUS" in
  200) jq -e '.source == "model" and .card.topic == "automation"' /tmp/smoke_build.json >/dev/null ;;
  503) jq -e '.error.code == "AI_UNAVAILABLE" or .error.code == "AI_INVALID_OUTPUT"' /tmp/smoke_build.json >/dev/null ;;
  *) echo "FAIL build-card: unexpected $BUILD_STATUS: $(cat /tmp/smoke_build.json)" >&2; exit 1 ;;
esac
echo "build-card -> $BUILD_STATUS"
rm -f /tmp/smoke_build.json

# TODO (push 2): publish -> catalog -> confirm changes position -> proposal -> PATCH accepted.

echo "OK"
