# AI-модуль MVP

Python 3.12, FastAPI, Pydantic v2, официальный OpenAI Python SDK.
Модуль не хранит данные, не вычисляет рейтинг и не публикует задачи.

## Запуск из корня репозитория (PowerShell)

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements-dev.txt
Copy-Item backend/.env.example backend/.env
# В backend/.env укажите свой OPENAI_API_KEY; файл игнорируется git.
.\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --env-file backend/.env
```

`OPENAI_MODEL` по умолчанию `gpt-4.1-mini`; можно указать доступную вашему
проекту модель с поддержкой Structured Outputs. Без ключа сервер запускается.
`.env` загружается командой uvicorn выше, а не при импорте модуля.

Тесты без ключа, сети и платных вызовов:

```powershell
.\.venv\Scripts\python -m pytest -c backend/pytest.ini backend/tests -q
```

## Backend

В `app/main.py` создан минимальный FastAPI app с `app.include_router(router)`.
Для интеграции в общий backend достаточно импортировать `app.api.ai.router`
и зарегистрировать его один раз. Префикс `/api/ai` уже находится в router.
Вызов SDK: `AsyncOpenAI.responses.parse(text_format=...)`, `store=False`.
Документация: https://developers.openai.com/api/docs/guides/structured-outputs

На запрос к модели установлен общий timeout 20 секунд. Встроенные retry SDK
отключены. Невалидный structured output, отказ или неполный ответ дают один
повтор (не более двух вызовов). Сетевые/API ошибки сразу включают fallback
анализа или возвращают 503 при сборке карточки. Сырые ответы и исключения
провайдера в HTTP response не передаются.

Для grounding MVP извлекает точные цитаты из draft/answers. Backend отвергает
значения, которых нет в этих источниках. Topic сохраняется из явного ввода.
Это намеренно консервативный режим: свободное переформулирование не используется.
Проверка цитат не доказывает правильность смысловой классификации и не умеет
надёжно распознавать отрицания; модель обязана сохранять их по промпту.
Перед публикацией остаётся необходимым предусмотренное продуктом подтверждение
карточки пользователем. Проверка типов сама по себе не гарантирует фактичность.

Локальный fallback возвращает 5 шаблонных вопросов. Он не пытается семантически
разбирать произвольный текст, поэтому `known_fields` содержит только явно
переданный topic. `missing_fields` здесь означает поля, которые локальный режим
не смог извлечь; информация о них может уже присутствовать в draft. Интерфейс
должен сообщать об ограниченном режиме по заголовку `X-AI-Fallback: true`.
На успешном ответе модели заголовок равен `false`. При разных origin общий
backend должен добавить `X-AI-Fallback` в `expose_headers` своей CORS-настройки.

Если модель извлекла достаточно сведений и осталось менее трёх неизвестных
полей, API возвращает 409 `insufficient_missing_fields`. Это разрешает конфликт
требований «минимум три различных вопроса» и «только по отсутствующим сведениям»:
frontend может вызвать build-card с пустыми questions/answers.

## Frontend contract

```typescript
type CardField =
  | "title" | "topic" | "context" | "need" | "users" | "data"
  | "constraints" | "expected_result" | "success_criteria"
  | "contact" | "interaction_format";
type TaskCard = Record<CardField, string | null>;
type Question = { id: string; target_field: CardField; text: string };
type AnalyzeDraftRequest = { draft: string; topic?: string | null };
type AnalyzeDraftResponse = {
  known_fields: Partial<Record<CardField, string>>;
  missing_fields: CardField[];
  questions: Question[];
};
type BuildCardRequest = AnalyzeDraftRequest & {
  questions: Question[];
  answers: { question_id: string; answer: string }[];
};
type BuildCardResponse = { card: TaskCard };
type AIError = {
  detail: { code: "ai_unavailable" | "ai_invalid_output" |
    "insufficient_missing_fields"; message: string; retryable: boolean };
};
```

Оба endpoint принимают POST JSON. Сохраняйте исходный draft, topic, questions и
answers в состоянии формы до подтверждения карточки, в том числе при ошибке.
Сервер не изменяет запрос, но не является хранилищем черновиков.
При 503 покажите `detail.message` и кнопку «Повторить». При 422 используется
обычный массив ошибок FastAPI `detail`; это ошибка ввода, а не AIError.
Пустые или состоящие из пробелов строки запрещены. Неотвеченные вопросы можно
оставлять без записи в answers; пустой ответ отправлять не нужно.
Каждый answer должен ссылаться на переданный question.id; дубликаты запрещены.
Все 11 полей карточки присутствуют в ответе, неизвестные равны null.
OpenAPI схемы доступны в `/docs` и `/openapi.json`.

## Примеры запросов

Из корня репозитория, curl (в Windows используйте `curl.exe`):

```shell
curl -X POST http://127.0.0.1:8000/api/ai/analyze-draft -H "Content-Type: application/json" --data-binary @backend/examples/analyze-draft.json
curl -X POST http://127.0.0.1:8000/api/ai/build-card -H "Content-Type: application/json" --data-binary @backend/examples/build-card.json
```

Пример успешного build-card (реальная формулировка может отличаться):

```json
{
  "card": {
    "title": null,
    "topic": "Автоматизация",
    "context": "Заявки приходят в WhatsApp и обрабатываются вручную",
    "need": "Хотим улучшить обработку заявок клиентов",
    "users": null,
    "data": null,
    "constraints": null,
    "expected_result": null,
    "success_criteria": null,
    "contact": null,
    "interaction_format": null
  }
}
```

Без API-ключа второй запрос вернёт контролируемую ошибку 503.
