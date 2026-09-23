# AGENTS.md

Источник правды: docs/TZ.md (что делаем) и docs/api-contract.md (как общаются части). Противоречие — остановись и напиши в отчёте.

## Стек
Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, psycopg 3, Alembic, PostgreSQL, OpenAI Python SDK, pytest.
Frontend: React, TypeScript, Vite, React Router, fetch, Tailwind.
Всё запускается через docker compose.

## Владельцы
- №1 backend и интеграция: /backend (кроме файлов №3), docker-compose.yml, миграции, docs/api-contract.md.
- №2 frontend: /frontend.
- №3 AI и рейтинг: backend/app/services/ai_service.py, backend/app/services/rating_service.py, backend/app/schemas/ai.py, data/seed.json, backend/tests для рейтинга и AI, README.md.
Чужие файлы не меняй — опиши нужное изменение в отчёте.

## Команды (завершаются сами)
- docker compose up -d --build
- docker compose exec backend pytest -q
- scripts/smoke_test.sh
- docker compose down
Нельзя использовать как проверку docker compose up без -d и npm run dev — они не завершаются.

## Правила
- Ошибки: {"error":{"code","message"}}. Пользовательский ввод никогда не даёт 500.
- Рейтинг считает только rating_service.calculate_score. Сумма breakdown равна score.
- AI не выдумывает факты: неизвестное — null. Ответ модели проверяется Pydantic, один повтор, затем ошибка или fallback с source="fallback".
- Никакого автоматического выбора команд.
- Моки только в tests/. Во frontend временные данные удаляются к T+180.
- Секреты только в .env. Новые переменные — в .env.example.

## Отчёт после каждой задачи
Что изменено / Что проверено / Что не проверено / Какие блокеры.