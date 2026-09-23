# ASAR: frontend ↔ backend contract

Статический срез текущего рабочего дерева. Источники: `frontend/src/types.ts`, `frontend/src/api/client.ts`, `frontend/src/api/mockApi.ts`, страницы `CreatePage`, `CatalogPage`, `TaskPage`, зарегистрированные роутеры `backend/app/main.py`, `backend/app/api/{tasks,ai,meta}.py` и схемы `backend/app/schemas/{task,ai}.py`. `docs/api-contract.md` в текущем дереве отсутствует. Статусы показывают соответствие кода целевому HTTP-контракту; работающий HTTP-сценарий ими не подтверждается.

`MATCH` — путь и используемые поля подтверждены кодом; `MISMATCH` — путь есть, но контракт не совпадает; `MISSING` — путь не зарегистрирован; `UNVERIFIED` — недостаточно данных для проверки. Здесь нет `UNVERIFIED`: зарегистрированные маршруты и схемы доступны для статической сверки.

| Operation | Method | Required path | Request | Response | Backend status |
|-----------|--------|---------------|---------|----------|----------------|
| `createTask` | POST | `/api/tasks` | `{draft_text: string, topic: string}`; `topic` должен быть допустимым slug | `TaskOut` с `id`, `status: "draft"`; `id` нужен для confirm/publish | **MISMATCH**: маршрут используется внутри HTTP-сценария, но UI передаёт свободный текст темы, а backend принимает `TopicSlug \| null` |
| `analyzeDraft` | POST | `/api/ai/analyze-draft` | `{draft: string, topic: string}` | `{known_fields, missing_fields, questions}` (`AnalyzeDraftResponse`) | **MATCH** по пути и основным полям |
| `buildTaskCard` | POST | `/api/ai/build-card` | `{draft, topic, questions: ClarifyingQuestion[], answers: {question_id, answer}[]}` | `{card: TaskCard}` | **MATCH** по HTTP payload: `questions[]` передаются; HTTP adapter удаляет внутренний `target_field` из `answers[]` |
| `confirmTaskCard` | PUT | `/api/tasks/{task_id}/confirm` | `{card: TaskCard}` | `ScoreResult`: `score`, `readiness_level`, `readiness_label`, `breakdown`, `missing_fields` | **MISSING**: `PUT /api/tasks/{task_id}/confirm` |
| `publishTask` | POST | `/api/tasks/{task_id}/publish` | ID ранее созданной и подтверждённой задачи в пути; body согласовать | `{task_id: string, status: "published"}` (`PublishResult`) | **MISSING**: `POST /api/tasks/{task_id}/publish` |
| `getCatalog` | GET | `/api/tasks` | query `status=published`, `topic?`, `readiness_level?`, `sort?` (`score_desc`/`score_asc`/`newest`) | `PublishedTask[]` | **MISSING**: `GET /api/tasks` |
| `getTask` | GET | `/api/tasks/{task_id}` | ID задачи в пути | `PublishedTask` для опубликованной задачи; для 404 клиент возвращает `null` | **MISMATCH**: маршрут возвращает `TaskOut`, включая черновики и nullable score/date/fields; нет `readiness_label` |
| `getTeams` | GET | `/api/teams` | — | `Team[]`: `id`, `name`, `interests`, `skills`, `technologies` | **MATCH**: `TeamOut[]` содержит эти поля и дополнительное `points` |
| `getProposals` | GET | `/api/tasks/{task_id}/proposals` | ID задачи в пути | `Proposal[]`, включая `team_name` | **MISSING**: `GET /api/tasks/{task_id}/proposals` |
| `createProposal` | POST | `/api/tasks/{task_id}/proposals` | `{team_id, idea, plan, estimated_duration, prototype_url}` | Сохранённый `Proposal` со статусом `pending` | **MISSING**: `POST /api/tasks/{task_id}/proposals` |
| `updateProposalStatus` | PATCH | `/api/proposals/{proposal_id}` | `{status: "accepted" \| "rejected"}` | Обновлённый `Proposal` | **MISSING**: `PATCH /api/proposals/{proposal_id}` |

## Поля, которые нужно согласовать

| Операция | Frontend сейчас | Backend сейчас | Предлагаемое решение | Ответственный |
|----------|-----------------|----------------|----------------------|---------------|
| `createTask` | `/create` хранит `topic` как свободную строку; HTTP adapter создаёт draft при анализе и сохраняет полученный `TaskOut.id` для следующих шагов | `POST /api/tasks`: `draft_text`, `topic: TopicSlug \| null`; возвращает `TaskOut.id` | Согласовать значение темы с фактическими slug из `GET /api/meta` перед отправкой. Не подменять свободную строку произвольным slug без согласования UX. | Frontend и backend |

| `getTask` | `PublishedTask` требует `score: number`, `readiness_level`, `readiness_label`, `score_breakdown: ScoreBreakdownItem[]`, `missing_fields: MissingField[]`, `published_at: string`; 404 ожидается как `null` | `TaskOut` разрешает `draft`, nullable `score`, `readiness_level`, `score_breakdown`, `missing_fields`, `published_at`; `readiness_label` отсутствует, элементы breakdown описаны как `dict` | Для опубликованной задачи backend фиксирует shape элементов рейтинга и возвращает заполненные значения. `readiness_label` можно получить из `GET /api/meta` по slug или добавить в ответ; способ согласовать. Adapter переводит 404 в `null`, черновик не показывает как опубликованный и получает `readiness_label` из локальной карты slug. | Backend — response shape; frontend — нормализация и 404 |
| `confirmTaskCard` | HTTP adapter сохраняет `task_id` после создания draft и ожидает `ScoreResult.breakdown` | Маршрут отсутствует, модель `Task` имеет `confirmed_at`, `score_breakdown`, `missing_fields` | Добавить `PUT /api/tasks/{task_id}/confirm` с `{card}` и согласованным `ScoreResult`; frontend передаёт сохранённый `task_id`. | Backend — endpoint; frontend — ID в вызове |
| `publishTask` | `publishTask({card})`, ожидает `{task_id,status}` | Маршрут отсутствует | Добавить `POST /api/tasks/{task_id}/publish`, публиковать ранее подтверждённый draft, возвращать `PublishResult`; frontend передаёт `task_id`. | Backend — endpoint; frontend — ID в вызове |

Для отсутствующих маршрутов требуются именно endpoints из таблицы. `backend/app/models/proposal.py` описывает таблицу, но не регистрирует HTTP-маршрут и не задаёт схему `Proposal`: `team_name` у модели отсутствует; `prototype_url` в модели nullable, а форма frontend требует обязательный корректный HTTP(S) URL. В ответах proposal нужны `id`, `task_id`, `team_id`, `team_name`, `idea`, `plan`, `estimated_duration`, `prototype_url`, `status`, `created_at`. Backend должен добавить response schema и получить `team_name` из связанной команды либо согласовать отдельное получение имён; frontend обработает утверждённую схему.

## Тема и порядок сквозного сценария

`/create` сейчас принимает произвольную строку темы; `TaskCard.topic` тоже строка. Backend `TaskCreate.topic` ограничен enum `automation`, `analytics`, `marketing`, `education`, `finance`, `other` в `backend/app/schemas/task.py`. Источник допустимых slug и подписей уже есть: `GET /api/meta` → `topics[]`. `POST /api/ai/analyze-draft` и `POST /api/ai/build-card` принимают свободную строку `topic`; ограничение возникает при сохранении draft через `POST /api/tasks`. Пока не согласовано отображение свободного ввода на slug, реальное создание задачи **BLOCKED**; новый список тем придумывать не требуется.

Путь интеграции: `createTask` (внутри HTTP-анализа) → `analyzeDraft` → `buildTaskCard` (с исходными `questions[]`; ответы сериализуются без `target_field`) → `confirmTaskCard(task_id)` → `publishTask(task_id)` → `getCatalog` → `getTask`/`getProposals` → `createProposal` → `updateProposalStatus`. `client.ts` централизованно выбирает mock или `httpApi`; mock остаётся режимом по умолчанию. Подготовленный HTTP adapter не подтверждает готовность отсутствующих backend endpoints и сквозной HTTP-интеграции.
