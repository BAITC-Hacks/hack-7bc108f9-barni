"""Opt-in checks against the configured OpenAI model, using synthetic business data."""

import os
from pathlib import Path

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.ai import AnalyzeDraftResponse, BuildCardResponse

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_LIVE_AI") != "1", reason="Set RUN_LIVE_AI=1 for paid OpenAI checks"
)


@pytest.fixture
def client():
    load_dotenv(Path(__file__).parents[1] / ".env")
    if not os.getenv("OPENAI_API_KEY", "").strip():
        pytest.fail("OPENAI_API_KEY is missing", pytrace=False)
    with TestClient(app) as client:
        yield client


def test_live_analyze_then_build(client):
    draft = "Хотим улучшить обработку заявок клиентов"
    response = client.post(
        "/api/ai/analyze-draft", json={"draft": draft, "topic": "Автоматизация"}
    )
    assert response.status_code == 200
    assert response.headers["X-AI-Fallback"] == "false", (
        "Real AI failed; fallback is not a passing live test"
    )
    analysis = AnalyzeDraftResponse.model_validate(response.json())
    assert analysis.known_fields.get("need")
    for field in ("data", "contact", "constraints", "success_criteria", "users"):
        assert field not in analysis.known_fields
    context = next((q for q in analysis.questions if q.target_field == "context"), None)
    assert context is not None
    response = client.post(
        "/api/ai/build-card",
        json={
            "draft": draft,
            "topic": "Автоматизация",
            "questions": [q.model_dump() for q in analysis.questions],
            "answers": [
                {
                    "question_id": context.id,
                    "answer": "Заявки приходят в WhatsApp и обрабатываются вручную",
                }
            ],
        },
    )
    assert response.status_code == 200
    card = BuildCardResponse.model_validate(response.json()).card
    assert card.context and "WhatsApp" in card.context
    assert card.need
    assert card.topic == "Автоматизация"
    for field in ("data", "contact", "constraints", "success_criteria", "users"):
        assert getattr(card, field) is None


@pytest.mark.parametrize(
    "draft,expected,unknown",
    [
        (
            "Заявки обрабатываются вручную. Данные: CSV с заявками. "
            "Пользователи: операторы поддержки. Ограничения: срок 2 недели. "
            "Ожидаемый результат: прототип формы заявок. "
            "Критерий успеха: обработка заявки за 5 минут.",
            {
                "data": "CSV",
                "users": "операторы",
                "constraints": "2 недели",
                "expected_result": "прототип",
                "success_criteria": "5 минут",
            },
            ["contact", "interaction_format"],
        ),
        (
            "Хотим улучшить обработку заявок. Данных для команды нет. "
            "Сроки не определены. Контакт пока не назначен.",
            {"data": "нет", "constraints": "не определены", "contact": "не назначен"},
            ["users", "success_criteria", "expected_result"],
        ),
    ],
)
def test_live_build_grounding(client, draft, expected, unknown):
    response = client.post(
        "/api/ai/build-card", json={"draft": draft, "questions": [], "answers": []}
    )
    assert response.status_code == 200
    card = BuildCardResponse.model_validate(response.json()).card
    for field, fragment in expected.items():
        value = getattr(card, field)
        assert value and fragment in value
    for field in unknown:
        assert getattr(card, field) is None


def test_live_analysis_does_not_ask_for_supplied_facts(client):
    response = client.post(
        "/api/ai/analyze-draft",
        json={
            "draft": "Хотим ускорить обработку заявок. Сейчас операторы вручную переносят заявки из почты в таблицу. Данные для команды: CSV с заявками. Ожидаемый результат: прототип формы заявок.",
            "topic": "Автоматизация",
        },
    )
    assert response.status_code == 200
    assert response.headers["X-AI-Fallback"] == "false"
    result = AnalyzeDraftResponse.model_validate(response.json())
    for field in ("context", "data", "expected_result", "need", "topic"):
        assert field in result.known_fields
        assert all(q.target_field != field for q in result.questions)
