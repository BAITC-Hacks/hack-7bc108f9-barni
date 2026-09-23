#!/usr/bin/env bash
# Smoke test against a running stack: docker compose up -d --build && scripts/smoke_test.sh
# Requires curl and jq.
set -euo pipefail

API="${API_URL:-http://localhost:8000}"
cd "$(dirname "$0")/.."

# Every task created here is deleted on exit (its proposals go with it via ON DELETE
# CASCADE), so the catalog is the same before and after. SMOKE_KEEP_DATA=1 keeps them.
CREATED=()
cleanup() {
  [[ "${SMOKE_KEEP_DATA:-}" == 1 || ${#CREATED[@]} -eq 0 ]] && return 0
  local ids
  ids=$(printf "'%s'," "${CREATED[@]}")
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "${POSTGRES_USER:-postgres}" \
    -d "${POSTGRES_DB:-hackalem}" \
    -c "DELETE FROM tasks WHERE id IN (${ids%,}) OR title LIKE '[smoke]%'" >/dev/null
  CREATED=()
}
trap cleanup EXIT
catalog_snapshot() { curl -sf "$API/api/tasks" | jq -c '[.[] | {id, score, proposals_count}]'; }

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

CATALOG_BEFORE=$(catalog_snapshot)

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
CREATED+=("$TASK_ID")
echo "$TASK" | jq -e '.status == "draft" and .score == null and .card.topic == "automation" and .confirmed_at == null' >/dev/null
echo "task_id=$TASK_ID"

step "get task"
call GET "/api/tasks/$TASK_ID" 200 | jq -e --arg id "$TASK_ID" '.id == $id and .proposals_count == 0' >/dev/null

step "errors use {error:{code,message}}"
call GET /api/tasks/00000000-0000-0000-0000-000000000000 404 | jq -e '.error.code == "TASK_NOT_FOUND"' >/dev/null
call POST /api/tasks 422 '{"draft_text":"x","topic":"unknown"}' | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null

PARTIAL_CARD='{"title":"[smoke] Оптимизация обработки заявок","topic":"automation","context":"Заявки приходят в WhatsApp и обрабатываются вручную","need":"Сократить время обработки заявок","data":"","users":"  ","constraints":null,"expected_result":null,"success_criteria":null,"contact":null,"interaction_format":null}'
FULL_CARD='{"title":"[smoke] Оптимизация обработки заявок","topic":"automation","context":"Заявки приходят в WhatsApp и обрабатываются вручную","need":"Сократить время обработки заявок","users":"Операторы службы поддержки","data":"Выгрузка заявок за 3 месяца в CSV","constraints":"2 недели, Python","expected_result":"Прототип бота для заявок","success_criteria":"Время ответа меньше 5 минут","contact":"@manager","interaction_format":"Созвон раз в неделю"}'

step "rating preview: partial card = 20, nothing saved"
call POST /api/rating/preview 200 "{\"card\":$PARTIAL_CARD}" \
  | jq -e '.score == 20 and .readiness_level == "draft" and ([.breakdown[].earned] | add) == .score' >/dev/null
call GET "/api/tasks/$TASK_ID" 200 | jq -e '.score == null and .confirmed_at == null' >/dev/null

step "confirm partial card: blank strings -> null, score 20"
call PUT "/api/tasks/$TASK_ID/confirm" 200 "{\"card\":$PARTIAL_CARD}" \
  | jq -e '.score == 20 and .readiness_level == "draft" and .confirmed_at != null
           and .card.data == null and .card.users == null and .title == "[smoke] Оптимизация обработки заявок"
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
BUILD_OUT=$(mktemp)
BUILD_STATUS=$(curl -s -o "$BUILD_OUT" -w '%{http_code}' -X POST "$API/api/ai/build-card" \
  -H 'Content-Type: application/json' \
  -d '{"draft":"Хотим улучшить обработку заявок клиентов","topic":"automation","questions":[{"id":"q1","target_field":"context","text":"Как сейчас обрабатываются заявки?"}],"answers":[{"question_id":"q1","answer":"Заявки приходят в WhatsApp и обрабатываются вручную"}]}')
case "$BUILD_STATUS" in
  200) jq -e '.source == "model" and .card.topic == "automation"' "$BUILD_OUT" >/dev/null ;;
  503) jq -e '.error.code == "AI_UNAVAILABLE" or .error.code == "AI_INVALID_OUTPUT"' "$BUILD_OUT" >/dev/null ;;
  *) echo "FAIL build-card: unexpected $BUILD_STATUS: $(cat "$BUILD_OUT")" >&2; exit 1 ;;
esac
echo "build-card -> $BUILD_STATUS"
rm -f "$BUILD_OUT"

# Full demo chain, tz.md §20.
position() {  # task id -> 0-based position in the published catalog, -1 if absent
  call GET /api/tasks 200 | jq --arg id "$1" '[.[].id] | index($id) // -1'
}
TEAMS=$(call GET /api/teams 200)
ALPHA=$(echo "$TEAMS" | jq -er '.[] | select(.name == "Team Alpha") | .id')
BETA=$(echo "$TEAMS" | jq -er '.[] | select(.name == "Team Beta") | .id')

step "chain: create -> publish before confirm is 409"
DEMO=$(call POST /api/tasks 201 '{"draft_text":"Хотим улучшить обработку заявок клиентов","topic":"automation"}' | jq -er .id)
CREATED+=("$DEMO")
call POST "/api/tasks/$DEMO/publish" 409 | jq -e '.error.code == "TASK_NOT_CONFIRMED"' >/dev/null
call POST "/api/tasks/$DEMO/proposals" 409 \
  "{\"team_id\":\"$ALPHA\",\"idea\":\"Бот\",\"plan\":\"План\",\"estimated_duration\":\"2 недели\"}" \
  | jq -e '.error.code == "TASK_NOT_PUBLISHED"' >/dev/null

step "chain: confirm partial card -> publish (repeat is idempotent)"
call PUT "/api/tasks/$DEMO/confirm" 200 "{\"card\":$PARTIAL_CARD}" | jq -e '.score == 20' >/dev/null
FIRST=$(call POST "/api/tasks/$DEMO/publish" 200 | jq -er '.status + " " + .published_at')
SECOND=$(call POST "/api/tasks/$DEMO/publish" 200 | jq -er '.status + " " + .published_at')
[[ "$FIRST" == "$SECOND" && "$FIRST" == published* ]] || { echo "FAIL publish not idempotent: $FIRST / $SECOND" >&2; exit 1; }

step "chain: a 70-point task published after it ranks higher"
REF=$(call POST /api/tasks 201 '{"draft_text":"Эталонная задача каталога","topic":"analytics"}' | jq -er .id)
CREATED+=("$REF")
REF_CARD='{"card":{"title":"[smoke] Эталон","topic":"analytics","context":"Отчёты собираются вручную","need":"Автоматизировать сбор отчётов","data":"Выгрузки из CRM","expected_result":"Готовый дашборд продаж","success_criteria":"Отчёт за пять минут"}}'
call PUT "/api/tasks/$REF/confirm" 200 "$REF_CARD" | jq -e '.score == 70 and .readiness_level == "ready"' >/dev/null
call POST "/api/tasks/$REF/publish" 200 >/dev/null
BEFORE=$(position "$DEMO"); REF_POS=$(position "$REF")
echo "catalog position before: demo=$BEFORE, reference=$REF_POS"
(( BEFORE > REF_POS )) || { echo "FAIL demo should rank below reference" >&2; exit 1; }

step "chain: catalog filters and low score stays visible"
call GET "/api/tasks?topic=automation&readiness=draft" 200 | jq -e --arg id "$DEMO" 'any(.[]; .id == $id and .score == 20)' >/dev/null
call GET "/api/tasks?topic=analytics" 200 | jq -e --arg id "$DEMO" 'all(.[]; .id != $id and .topic == "analytics")' >/dev/null
call GET "/api/tasks?readiness=unknown" 422 | jq -e '.error.code == "VALIDATION_ERROR"' >/dev/null

step "chain: confirm full card on the published task -> position rises"
call PUT "/api/tasks/$DEMO/confirm" 200 "{\"card\":$FULL_CARD}" | jq -e '.score == 100 and .status == "published"' >/dev/null
AFTER=$(position "$DEMO"); REF_POS=$(position "$REF")
echo "catalog position after: demo=$AFTER, reference=$REF_POS"
(( AFTER < BEFORE && AFTER < REF_POS )) || { echo "FAIL demo did not move up" >&2; exit 1; }

step "chain: Team Alpha proposal -> accepted"
P_ALPHA=$(call POST "/api/tasks/$DEMO/proposals" 201 \
  "{\"team_id\":\"$ALPHA\",\"idea\":\"Чат-бот в WhatsApp\",\"plan\":\"Прототип за неделю\",\"estimated_duration\":\"2 недели\",\"prototype_url\":\"https://example.com/demo\"}" \
  | jq -er 'select(.status == "pending" and .team_name == "Team Alpha") | .id')
call PATCH "/api/proposals/$P_ALPHA" 200 '{"status":"accepted"}' | jq -e '.status == "accepted"' >/dev/null

step "chain: Team Beta proposal -> rejected"
P_BETA=$(call POST "/api/tasks/$DEMO/proposals" 201 \
  "{\"team_id\":\"$BETA\",\"idea\":\"Форма заявок на сайте\",\"plan\":\"Лендинг и CRM\",\"estimated_duration\":\"3 недели\",\"prototype_url\":null}" \
  | jq -er 'select(.status == "pending") | .id')
call PATCH "/api/proposals/$P_BETA" 200 '{"status":"rejected"}' | jq -e '.status == "rejected"' >/dev/null

step "chain: repeated decision -> 409"
call PATCH "/api/proposals/$P_BETA" 409 '{"status":"accepted"}' | jq -e '.error.code == "PROPOSAL_ALREADY_DECIDED"' >/dev/null

step "chain: business sees both proposals, teams see their statuses"
call GET "/api/tasks/$DEMO/proposals" 200 \
  | jq -e --arg a "$P_ALPHA" --arg b "$P_BETA" '[.[] | {(.id): .status}] | add | .[$a] == "accepted" and .[$b] == "rejected"' >/dev/null
call GET "/api/tasks/$DEMO" 200 | jq -e '.proposals_count == 2' >/dev/null
call GET "/api/proposals?team_id=$ALPHA" 200 | jq -e --arg id "$P_ALPHA" 'any(.[]; .id == $id and .status == "accepted" and .task_title == "[smoke] Оптимизация обработки заявок")' >/dev/null
call GET "/api/proposals?team_id=$BETA" 200 | jq -e --arg id "$P_BETA" 'any(.[]; .id == $id and .status == "rejected")' >/dev/null

# Consumed by scripts/restart_check.sh.
if [[ -n "${SMOKE_STATE_FILE:-}" ]]; then
  printf 'DEMO=%s\nP_ALPHA=%s\nP_BETA=%s\n' "$DEMO" "$P_ALPHA" "$P_BETA" > "$SMOKE_STATE_FILE"
fi

if [[ "${SMOKE_KEEP_DATA:-}" != 1 ]]; then
  step "cleanup: catalog is the same as before the run"
  cleanup
  [[ "$(catalog_snapshot)" == "$CATALOG_BEFORE" ]] || { echo "FAIL catalog changed after cleanup" >&2; exit 1; }
fi

echo "OK"
