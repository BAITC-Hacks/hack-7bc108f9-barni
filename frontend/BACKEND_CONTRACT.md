# ASAR: frontend ↔ backend contract

Статический срез `origin/main` на коммите `138b54f` (пуш 1; backend tree совпадает с прежним `778d5eb`). Источники: `docs/api-contract.md`, `docs/api-examples.md` и зарегистрированные роутеры/схемы backend на этом коммите. `docs/api-contract.md` описывает также пуш 2; строка «ожидается» ниже означает, что маршрут прописан в контракте, но ещё не реализован в пуше 1. Работающий HTTP-сценарий этим документом не подтверждается.

## Реальные и ожидаемые операции

| Операция | Маршрут | Запрос | Ответ по коду или контракту | Состояние пуша 1 |
|---|---|---|---|---|
| Проверка сервера | `GET /health` | — | `{status:"ok"}` | Реализовано |
| Справочники | `GET /api/meta` | — | `{topics:[{slug,label}],readiness_levels:[{slug,label,min,max}]}` | Реализовано |
| Демо-команды | `GET /api/teams` | — | `TeamOut[]`, в том числе `points` | Реализовано |
| Создать черновик | `POST /api/tasks` | `{draft_text,topic?:TopicSlug or null}` | `201 TaskDetail`, включая `id` и `proposals_count` | Реализовано |
| Получить задачу | `GET /api/tasks/{id}` | UUID в пути | `TaskDetail`, включая nullable рейтинг и `proposals_count` | Реализовано |
| Анализ черновика | `POST /api/ai/analyze-draft` | `{draft,topic?:TopicSlug or null}` | `{known_fields,missing_fields,questions,source}` | Реализовано |
| Сборка карточки | `POST /api/ai/build-card` | `{draft,topic?:TopicSlug or null,questions,answers}` | `{card,source}` | Реализовано |
| Предварительный рейтинг | `POST /api/rating/preview` | `{card:EditableCard}` | `ScoreResult`: `score,readiness_level,breakdown,missing_fields` | Реализовано |
| Подтвердить карточку | `PUT /api/tasks/{id}/confirm` | `{card:EditableCard}` | Обновлённый **TaskDetail**, рейтинг в `score_breakdown` | Реализовано |
| Опубликовать | `POST /api/tasks/{id}/publish` | Без тела | Полный **TaskDetail** со `status:"published"` | Ожидается в пуше 2 |
| Каталог | `GET /api/tasks` | `status?`, `topic?`, `readiness?`, `sort?` | **TaskSummary[]**, только опубликованные по умолчанию | Ожидается в пуше 2 |
| Отправить предложение | `POST /api/tasks/{id}/proposals` | `team_id,idea,plan,estimated_duration,prototype_url?` | `201 Proposal` | Ожидается в пуше 2 |
| Предложения задачи | `GET /api/tasks/{id}/proposals` | UUID в пути | `Proposal[]` | Ожидается в пуше 2 |
| Предложения команды | `GET /api/proposals?team_id={id}` | `team_id` обязателен | Предложения с кратким `task:{id,title,topic}` | Ожидается в пуше 2 |
| Решение бизнеса | `PATCH /api/proposals/{id}` | `{status:"accepted" or "rejected"}` | Обновлённый `Proposal` | Ожидается в пуше 2 |

`TopicSlug`: `automation | analytics | marketing | education | finance | other`. Подписи берутся из `GET /api/meta`, а не из текста свободного ввода. `ReadinessSlug`: `draft | working | ready | priority`. Поля `TaskCard` — `title, topic, context, need, users, data, constraints, expected_result, success_criteria, contact, interaction_format`. В `EditableCard` каждое поле можно опустить; пустая строка превращается в `null`, лишнее поле даёт 422, `topic` принимает только slug или `null`.

`TaskDetail` содержит `id,status,draft_text,title,topic,card,score,readiness_level,score_breakdown,missing_fields,confirmed_at,published_at,created_at,updated_at,proposals_count`. До подтверждения рейтинг и время подтверждения равны `null`. `TaskSummary` содержит `id,title,topic,context,score,readiness_level,missing_fields,published_at` без полной `card` и `score_breakdown`. У `Proposal` по контракту нет `team_name`; `prototype_url` допускает `null`.

## Сопоставление frontend

| Место | Текущий frontend | Проверка |
|---|---|---|
| Тема | `/create` и редактор карточки получают slug и русскую подпись из `/api/meta`; в API уходит slug | Типы и сборка; HTTP не запускался |
| Подтверждение | `httpApi` преобразует `TaskDetail.score_breakdown` в `ScoreResult.breakdown` и добавляет подпись уровня | Типы и сборка; HTTP не запускался |
| Публикация | `httpApi` преобразует `TaskDetail.id/status` в `PublishResult` | Маршрут ожидается в пуше 2 |
| Каталог | `httpApi` читает `TaskSummary[]`, передаёт `readiness` и серверный `score_desc`; остальные два порядка сортирует клиент | Маршрут ожидается в пуше 2 |
| Предложения | UI берёт имя команды из `/api/teams`, передаёт пустую ссылку на прототип как null и сверяет сохранённый team ID; ошибка списка не скрывает задачу | Маршруты ожидаются в пуше 2 |
| Ответ AI | UI показывает `source`; `409 INSUFFICIENT_MISSING_FIELDS` ведёт к сборке без вопросов; таймаут AI 50 секунд | Типы и сборка; платный AI не вызывался |
| Предварительный рейтинг | `POST /api/rating/preview` доступен, но текущий основной сценарий считает официальный рейтинг через confirm | Не подключён к UI |
| Предложения команды | Статус своего предложения виден на странице задачи; глобальный `GET /api/proposals?team_id=` используется разделом «Мои предложения» в каталоге | Маршрут ожидается в пуше 2 |
Для `analyze-draft` предусмотрен `409 INSUFFICIENT_MISSING_FIELDS`: если неизвестных полей меньше трёх, клиент сразу вызывает `build-card` с `questions:[]` и `answers:[]`. При отсутствии ключа или сбое провайдера `analyze-draft` отвечает `200`, `source:"fallback"`; `build-card` fallback не имеет и отвечает `503 AI_UNAVAILABLE`. Ошибки обёрнуты в `{error:{code,message}}` (для AI может быть `retryable`). CORS по умолчанию допускает `http://localhost:5173`, настраивается `CORS_ORIGINS`.

## Путь интеграции

`/meta` → создать черновик → анализ → сборка карточки → предварительный рейтинг при необходимости → подтвердить → опубликовать → каталог → подробная задача → предложение → ручное решение. Пуш 1 закрывает путь только до подтверждения. Публикация, каталог и предложения зависят от пуша 2; наличие описания в контракте не означает доступности этих маршрутов.
