# API-контракт

Источник: `tz.md` (обязательные разделы 5, 6, 7, 11, 12) + решения команды,
закрывающие пробелы ТЗ (см. список ниже). AI-эндпоинты задокументированы по
уже реализованному коду (`backend/app/api/ai.py`, `app/schemas/ai.py`,
`app/services/ai_service.py`) как по источнику истины. Реальные ответы —
в `docs/api-examples.md`.

## 0. Общие соглашения

- Все запросы и ответы — `application/json`.
- Идентификаторы (`task_id`, `team_id`, `proposal_id`) — UUID строкой.
- Идентификация роли/команды в MVP не защищена (нет регистрации, см. tz.md §2.1,
  §13.4) — `team_id` клиент передаёт сам явно в теле/query запроса.
- Формат любой ошибки:
  ```json
  { "error": { "code": "SNAKE_CASE", "message": "текст для пользователя" } }
  ```
  HTTP-статус соответствует характеру ошибки (см. таблицу §8). Пользовательский
  ввод никогда не должен приводить к 500.
- `TopicSlug` — `"automation" | "analytics" | "marketing" | "education" | "finance" | "other"`.
- `ReadinessSlug` — `"draft" | "working" | "ready" | "priority"`.
- `CardField` — одно из 11 полей карточки (см. §1 «Общие типы»).

## 1. Общие типы

### TaskCard

Ровно 11 полей, каждое — непустая строка после `trim` или `null`. Лишние поля
запрещены (strict-схема, как в `app/schemas/ai.py`).

```json
{
  "title": "string | null",
  "topic": "TopicSlug | null",
  "context": "string | null",
  "need": "string | null",
  "users": "string | null",
  "data": "string | null",
  "constraints": "string | null",
  "expected_result": "string | null",
  "success_criteria": "string | null",
  "contact": "string | null",
  "interaction_format": "string | null"
}
```

### ScoreResult (tz.md §6.3)

```json
{
  "score": 75,
  "readiness_level": "ready",
  "breakdown": [
    {
      "field": "context",
      "label": "Контекст",
      "earned": 10,
      "maximum": 10,
      "reason": "Контекст: указано"
    }
  ],
  "missing_fields": [
    {
      "field": "success_criteria",
      "label": "Критерии успеха",
      "potential_points": 15,
      "recommendation": "Добавьте измеримые признаки успешного результата"
    }
  ]
}
```

Рейтинг считается по 9 полям (title и topic не оцениваются, tz.md §6.2):
context 10, need 10, data 20, expected_result 15, success_criteria 15,
constraints 10, users 10, contact 5, interaction_format 5 = 100. Сумма
`breakdown[].earned` обязана равняться `score`. `breakdown` всегда содержит все
9 полей в этом порядке. Баллы бинарные: поле заполнено (есть хотя бы одна буква
или цифра) — полный вес, иначе 0; длина текста не влияет (tz.md §6.5).
Уровень: `draft` 0–39, `working` 40–69, `ready` 70–89, `priority` 90–100.

### Task (полное представление, tz.md §11.1)

```json
{
  "id": "uuid",
  "status": "draft",
  "draft_text": "string",
  "title": "string | null",
  "topic": "TopicSlug | null",
  "card": "TaskCard",
  "score": "integer | null",
  "readiness_level": "ReadinessSlug | null",
  "score_breakdown": "ScoreResult.breakdown | null",
  "missing_fields": "ScoreResult.missing_fields | null",
  "confirmed_at": "ISO-8601 | null",
  "published_at": "ISO-8601 | null",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "proposals_count": 0
}
```

Этот же объект (TaskDetail) возвращают `POST /api/tasks`, `GET /api/tasks/{id}`,
`PUT /confirm` и `POST /publish`. `proposals_count` — число всех предложений по
задаче (любого статуса).
`score`/`readiness_level`/`score_breakdown`/`missing_fields` равны `null` до
первого `confirm` — рассчитывает их только `rating_service.calculate_score`
(tz.md §6.3), не AI.

### TaskSummary (карточка каталога, tz.md §13.2)

```json
{
  "id": "uuid",
  "title": "string | null",
  "topic": "TopicSlug | null",
  "context": "string | null",
  "score": "integer",
  "readiness_level": "ReadinessSlug",
  "missing_fields": "ScoreResult.missing_fields",
  "published_at": "ISO-8601"
}
```

В каталог попадают только задачи с `status = published`, у них `score` и
`readiness_level` не бывают `null` (публикация требует подтверждения — см. §5.3).

### Team (tz.md §11.2)

```json
{
  "id": "uuid",
  "name": "string",
  "interests": ["string"],
  "skills": ["string"],
  "technologies": ["string"],
  "points": 0
}
```

### Proposal (tz.md §11.3)

```json
{
  "id": "uuid",
  "task_id": "uuid",
  "team_id": "uuid",
  "idea": "string",
  "plan": "string",
  "estimated_duration": "string",
  "prototype_url": "string | null",
  "status": "pending",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601"
}
```

---

## 2. Системный

### GET /health

Ответ `200`:
```json
{ "status": "ok" }
```
Ошибок нет.

---

## 3. GET /api/meta *(решение №3)*

Фиксированные справочники для фильтров каталога и формы создания.

Ответ `200`:
```json
{
  "topics": [
    { "slug": "automation", "label": "Автоматизация" },
    { "slug": "analytics", "label": "Аналитика" },
    { "slug": "marketing", "label": "Маркетинг" },
    { "slug": "education", "label": "Образование" },
    { "slug": "finance", "label": "Финансы" },
    { "slug": "other", "label": "Другое" }
  ],
  "readiness_levels": [
    { "slug": "draft", "label": "Черновик", "min": 0, "max": 39 },
    { "slug": "working", "label": "Рабочая", "min": 40, "max": 69 },
    { "slug": "ready", "label": "Готовая", "min": 70, "max": 89 },
    { "slug": "priority", "label": "Приоритетная", "min": 90, "max": 100 }
  ]
}
```
Ошибок нет (статичные данные).

---

## 4. GET /api/teams *(решение №4)*

Список профилей для демонстрационного переключателя роли (tz.md §13.4).

Ответ `200`:
```json
[
  {
    "id": "uuid",
    "name": "Team Alpha",
    "interests": ["automation"],
    "skills": ["Python", "React"],
    "technologies": ["FastAPI", "PostgreSQL"],
    "points": 0
  }
]
```
Ошибок нет.

---

## 5. Задачи (Tasks)

### 5.1 POST /api/tasks

Создание черновика (tz.md §12, FR-01).

Запрос:
```json
{ "draft_text": "Хотим улучшить обработку заявок клиентов", "topic": "automation" }
```
`draft_text` — обязательная непустая строка (≤ 20000 симв., по аналогии с
`AnalyzeDraftRequest.draft`). `topic` — необязателен, `TopicSlug | null`.

Ответ `201`: объект `Task` в статусе `draft`, `card` со всеми полями `null`
кроме `topic` (если передан), `score`/`readiness_level` = `null`.

Ошибки: `422 VALIDATION_ERROR` (пустой/слишком длинный `draft_text`, неизвестный `topic`).

### 5.2 GET /api/tasks/{task_id}

Ответ `200`: объект `Task` (полная карточка + рейтинг, если уже подтверждён).
Ошибки: `404 TASK_NOT_FOUND`.

### 5.3 PUT /api/tasks/{task_id}/confirm *(решение №8)*

Подтверждение карточки и (пере)расчёт рейтинга. Разрешён и для уже
опубликованной задачи — пересчёт может изменить её место в каталоге
(tz.md §6.5 «После пересчёта каталог должен изменить порядок задач»).

Запрос:
```json
{ "card": { "...": "EditableCard" } }
```
`EditableCard` — те же 11 полей, что `TaskCard`, но мягче на входе: любое поле
можно не передавать (= `null`), пустая строка или одни пробелы → `null`, строки
обрезаются по краям. `topic` — только `TopicSlug`. Лишние поля → 422.

Backend (tz.md §12): валидирует карточку → считает рейтинг →
сохраняет `score_breakdown`/`missing_fields` → ставит/обновляет `confirmed_at`.
`status` и `published_at` не меняются.

Ответ `200`: обновлённый объект `Task` (со свежими `score`, `readiness_level`,
`score_breakdown`, `missing_fields`, `confirmed_at`).

`title` и `topic` задачи обновляются из карточки.

Ошибки: `404 TASK_NOT_FOUND`, `422 VALIDATION_ERROR` (лишнее поле, `topic` не slug).

### 5.4 POST /api/tasks/{task_id}/publish *(решение №7)*

Требует непустой `confirmed_at`. Повторный вызов идемпотентен — если задача
уже `published`, отвечает `200` без изменений (не ошибка).

Запрос: тело не требуется.

Ответ `200`: объект `Task` со `status = "published"` и проставленным (или уже
существовавшим) `published_at`.

Ошибки:
- `404 TASK_NOT_FOUND`
- `409 TASK_NOT_CONFIRMED` — `confirmed_at` ещё `null`.

### 5.5 GET /api/tasks — каталог (tz.md §12, FR-08/09/10)

Query-параметры (все необязательны):
- `status` — `"draft" | "published"`, по умолчанию `"published"` (каталог по
  умолчанию показывает только опубликованные задачи, FR-08).
- `topic` — `TopicSlug`.
- `readiness` — `ReadinessSlug`.
- `sort` — на сегодня единственное значение `"score_desc"` (по умолчанию).

Сортировка *(решение №11)*: `score` убыв., при равенстве — `published_at` убыв.

Ответ `200`: массив `TaskSummary`.

Ошибки: `422 VALIDATION_ERROR` (неизвестное значение `topic`/`readiness`/`sort`).

---

## 6. Рейтинг

### POST /api/rating/preview *(решение №5)*

Предварительный рейтинг карточки без сохранения (tz.md §6.5 «До подтверждения
можно показывать Предварительный рейтинг»). Не требует существующей задачи и
не пишет ничего в БД.

Запрос:
```json
{ "card": { "...": "EditableCard, как в 5.3" } }
```

Ответ `200`: `ScoreResult` — тот же расчёт, что при confirm.

Ошибки: `422 VALIDATION_ERROR` (лишнее поле, `topic` не slug).

---

## 7. Предложения (Proposals)

### 7.1 POST /api/tasks/{task_id}/proposals *(решение №9)*

Отклик команды (tz.md §3 «Сценарий студента», FR-11). Разрешён при любом
рейтинге задачи (FR-14), но только на опубликованную задачу.

Запрос:
```json
{
  "team_id": "uuid",
  "idea": "Идея решения",
  "plan": "План реализации",
  "estimated_duration": "2 недели",
  "prototype_url": "https://..."
}
```
`prototype_url` — необязательное поле (`string | null`), остальные обязательны
и непустые.

Ответ `201`: объект `Proposal` со `status = "pending"`.

Ошибки:
- `404 TASK_NOT_FOUND`
- `404 TEAM_NOT_FOUND`
- `409 TASK_NOT_PUBLISHED` — задача существует, но ещё не опубликована.
- `422 VALIDATION_ERROR`

### 7.2 GET /api/tasks/{task_id}/proposals

Список предложений по задаче — для бизнеса (tz.md §3 «Решение бизнеса», §13.3).

Ответ `200`: массив `Proposal`.

Ошибки: `404 TASK_NOT_FOUND`.

### 7.3 GET /api/proposals?team_id=... *(решение №6)*

Команда видит статусы всех своих поданных предложений (обязательный
`team_id` в query — без него список неоднозначен). Каждый элемент дополнен
минимальным описанием задачи, иначе список статусов бесполезен без похода за
каждой задачей по отдельности.

Ответ `200`:
```json
[
  {
    "id": "uuid",
    "task_id": "uuid",
    "team_id": "uuid",
    "idea": "...",
    "plan": "...",
    "estimated_duration": "...",
    "prototype_url": "...",
    "status": "pending",
    "created_at": "ISO-8601",
    "updated_at": "ISO-8601",
    "task": { "id": "uuid", "title": "string | null", "topic": "TopicSlug | null" }
  }
]
```

Ошибки:
- `404 TEAM_NOT_FOUND`
- `422 VALIDATION_ERROR` — `team_id` не передан.

### 7.4 PATCH /api/proposals/{proposal_id} *(решение №10)*

Ручное решение бизнеса (tz.md §3 «Решение бизнеса», FR-12/13). Разрешён только
переход `pending → accepted` или `pending → rejected`.

Запрос:
```json
{ "status": "accepted" }
```
Допустимые значения: `"accepted" | "rejected"`.

Ответ `200`: обновлённый объект `Proposal`.

Ошибки:
- `404 PROPOSAL_NOT_FOUND`
- `409 PROPOSAL_ALREADY_DECIDED` — текущий `status` уже не `pending`.
- `422 VALIDATION_ERROR` — недопустимое значение `status` (например, `"pending"`).

---

## 8. AI

Реализовано в `backend/app/api/ai.py` / `app/services/ai_service.py`.
Заголовок `X-AI-Fallback: true|false` у analyze-draft сохранён для совместимости,
источник истины — поле `source`.

### 8.1 POST /api/ai/analyze-draft

Запрос:
```json
{ "draft": "Хотим улучшить обработку заявок клиентов", "topic": "automation" }
```
`draft` — обязательная непустая строка (≤ 20000 симв.). `topic` — необязателен
(`TopicSlug | null`).

Ответ `200`:
```json
{
  "known_fields": { "need": "Улучшить обработку заявок клиентов" },
  "missing_fields": ["context", "users", "data", "constraints", "expected_result", "success_criteria", "contact", "interaction_format"],
  "questions": [
    { "id": "q1", "target_field": "context", "text": "Как сейчас обрабатываются заявки?" },
    { "id": "q2", "target_field": "data", "text": "Какие данные по заявкам доступны?" },
    { "id": "q3", "target_field": "success_criteria", "text": "Какой измеримый результат будет считаться успешным?" }
  ],
  "source": "model"
}
```
`questions` — 3–5 элементов, каждый нацелен на поле из `missing_fields`, без
дублей. `source` — `"model"` (успешный вызов OpenAI) или `"fallback"`
(локальный шаблонный ответ) *(решение №12)*. `known_fields.topic`, если
есть, всегда slug: если `topic` не передан и модель вернула не slug, поле
переносится в `missing_fields`.

Ошибки:
- `422 VALIDATION_ERROR` — пустой/слишком длинный `draft`, неизвестный `topic`.
- `409 INSUFFICIENT_MISSING_FIELDS` — модель распознала карточку настолько
  полно, что неизвестных полей осталось меньше трёх; нельзя одновременно
  выполнить «минимум 3 вопроса» и «вопросы только по недостающим полям»
  (см. противоречие тз.md ниже). Клиент должен сразу вызвать `build-card` с
  пустыми `questions`/`answers`.
- Нет ключа, таймаут, ошибка провайдера или невалидный ответ модели после
  повтора — не ошибка: analyze-draft отвечает `200` с `"source": "fallback"`
  (шаблонные вопросы по пустым полям, tz.md §7.4).

### 8.2 POST /api/ai/build-card

Запрос:
```json
{
  "draft": "Хотим улучшить обработку заявок клиентов",
  "topic": "automation",
  "questions": [{ "id": "q1", "target_field": "context", "text": "..." }],
  "answers": [{ "question_id": "q1", "answer": "Заявки приходят в WhatsApp и обрабатываются вручную" }]
}
```
`questions` — те же вопросы, что вернул analyze-draft, передаются обратно как
есть. `questions`/`answers` — до 11 элементов, id уникальны, каждый
`answer.question_id` ссылается на переданный `questions[].id`; на неотвеченные
вопросы запись в `answers` не нужна. `topic` — `TopicSlug | null`.

Ответ `200`:
```json
{
  "card": {
    "title": null,
    "topic": "automation",
    "context": "Заявки поступают в WhatsApp и обрабатываются вручную",
    "need": "Сократить время обработки заявок",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  },
  "source": "model"
}
```
Fallback для build-card нет: при `200` всегда `"source": "model"`, при сбое
модели — `503`. `card.topic` — slug или `null`.

Ошибки:
- `422 VALIDATION_ERROR` — нарушена схема запроса (пустые строки, дубли id,
  ответ на несуществующий вопрос).
- `503 AI_UNAVAILABLE` — нет ключа / сетевая ошибка / ошибка провайдера после
  одного повтора.
- `503 AI_INVALID_OUTPUT` — ответ модели не прошёл валидацию Pydantic/grounding
  после одного повторного запроса.

У обоих 503 внутри `error` есть `"retryable": true` — показать кнопку «Повторить».

---

## 9. Коды ошибок (сводная таблица)

| Код | HTTP | Где встречается |
|---|---|---|
| `VALIDATION_ERROR` | 422 | любой эндпоинт с телом/query-параметрами |
| `TASK_NOT_FOUND` | 404 | 5.2, 5.3, 5.4, 7.1, 7.2 |
| `TEAM_NOT_FOUND` | 404 | 7.1, 7.3 |
| `PROPOSAL_NOT_FOUND` | 404 | 7.4 |
| `TASK_NOT_CONFIRMED` | 409 | 5.4 (решение №7) |
| `TASK_NOT_PUBLISHED` | 409 | 7.1 (решение №9) |
| `PROPOSAL_ALREADY_DECIDED` | 409 | 7.4 (решение №10) |
| `INSUFFICIENT_MISSING_FIELDS` | 409 | 8.1 (уже в коде как `insufficient_missing_fields`) |
| `AI_UNAVAILABLE` | 503, `retryable: true` | 8.2 (8.1 в этом случае отвечает fallback) |
| `INTERNAL_ERROR` | 500 | любая непредвиденная ошибка сервера, без деталей |
| `AI_INVALID_OUTPUT` | 503, `retryable: true` | 8.2 |

`retryable` — необязательное дополнительное поле внутри `error` только для AI-таймаутов/недоступности; остальные ошибки не ретраятся автоматически.
