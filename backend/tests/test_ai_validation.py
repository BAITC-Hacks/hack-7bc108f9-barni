import asyncio
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError, AsyncOpenAI
from pydantic import ValidationError

from app.main import app
from app.schemas.ai import (
    AnalyzeDraftRequest,
    AnalyzeDraftResponse,
    BuildCardRequest,
    BuildCardResponse,
    ModelAnalysis,
    Question,
    TaskCard,
)
from app.services.ai_service import (
    AIService,
    AIServiceError,
    analysis_from_card,
    fallback_analysis,
    get_ai_service,
)

DRAFT = "Хотим улучшить обработку заявок клиентов"
CONTEXT = "Заявки приходят в WhatsApp и обрабатываются вручную"


def card(**values):
    return TaskCard.model_validate(dict.fromkeys(TaskCard.model_fields) | values)


def analysis():
    questions = [
        Question(
            id="q1", target_field="context", text="Как сейчас обрабатываются заявки?"
        ),
        Question(
            id="q2", target_field="data", text="Какие данные по заявкам доступны?"
        ),
        Question(id="q3", target_field="success_criteria", text="Как измерить успех?"),
    ]
    return ModelAnalysis(card=card(need=DRAFT), questions=questions)


def request():
    return BuildCardRequest(
        draft=DRAFT,
        topic="automation",
        questions=[analysis().questions[0]],
        answers=[{"question_id": "q1", "answer": CONTEXT}],
    )


def service(*outputs):
    effects = [
        output
        if isinstance(output, Exception)
        else SimpleNamespace(status="completed", output_parsed=output)
        for output in outputs
    ]
    parse = AsyncMock(side_effect=effects)
    return AIService(
        SimpleNamespace(responses=SimpleNamespace(parse=parse)), "test-model"
    ), parse


@pytest.mark.parametrize("draft", ["", " ", "\n\t"])
def test_empty_draft(draft):
    with pytest.raises(ValidationError):
        AnalyzeDraftRequest(draft=draft)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d["questions"][0].update(target_field="invented"),
        lambda d: d["questions"][0].update(target_field="need"),
        lambda d: d["questions"][0].update(text="  "),
        lambda d: d["questions"].pop(),
        lambda d: d["questions"][1].update(id="q1"),
        lambda d: d["questions"][1].update(target_field="context"),
        lambda d: d["questions"][1].update(text=d["questions"][0]["text"]),
        lambda d: d["missing_fields"].append("invented"),
        lambda d: d["known_fields"].update(invented="fact"),
        lambda d: d["known_fields"].update(context="fact"),
        lambda d: d["missing_fields"].append("context"),
    ],
)
def test_invalid_analysis_rejected(mutation):
    result = analysis()
    data = analysis_from_card(result.card, result.questions).model_dump()
    mutation(data)
    with pytest.raises(ValidationError):
        AnalyzeDraftResponse.model_validate(data)


def test_fallback_is_deterministic_and_does_not_invent_facts():
    req = AnalyzeDraftRequest(draft=DRAFT, topic="automation")
    first = fallback_analysis(req)
    assert first == fallback_analysis(req)
    assert len(first.questions) >= 3
    assert first.known_fields == {"topic": "automation"}
    assert all(q.target_field in first.missing_fields for q in first.questions)


def test_successful_analysis():
    ai, parse = service(analysis())
    result, fallback = asyncio.run(ai.analyze(AnalyzeDraftRequest(draft=DRAFT)))
    assert not fallback
    assert result.known_fields == {"need": DRAFT}
    assert len(result.questions) == 3
    assert parse.await_count == 1
    assert parse.call_args.kwargs["text_format"] is ModelAnalysis
    assert parse.call_args.kwargs["store"] is False


def test_invalid_output_retries_once_then_falls_back():
    ai, parse = service(ValueError("bad JSON"), ValueError("bad JSON"))
    req = AnalyzeDraftRequest(draft=DRAFT)
    original = req.model_dump()
    result, fallback = asyncio.run(ai.analyze(req))
    assert fallback and len(result.questions) >= 3
    assert parse.await_count == 2
    assert req.model_dump() == original


def test_retry_recovers():
    ai, parse = service(ValueError("invalid"), analysis())
    _, fallback = asyncio.run(ai.analyze(AnalyzeDraftRequest(draft=DRAFT)))
    assert not fallback and parse.await_count == 2


@pytest.mark.parametrize(
    "error",
    [
        TimeoutError(),
        APIConnectionError(request=httpx.Request("POST", "https://example.test")),
    ],
)
def test_provider_failure_falls_back_without_retry(error):
    ai, parse = service(error)
    _, fallback = asyncio.run(ai.analyze(AnalyzeDraftRequest(draft=DRAFT)))
    assert fallback and parse.await_count == 1


def test_refusal_retries_then_falls_back():
    ai, parse = service(None, None)
    _, fallback = asyncio.run(ai.analyze(AnalyzeDraftRequest(draft=DRAFT)))
    assert fallback and parse.await_count == 2


def test_build_preserves_nulls_and_input():
    ai, _ = service(BuildCardResponse(card=card(need=DRAFT, context=CONTEXT)))
    req = request()
    original = req.model_dump()
    result = asyncio.run(ai.build(req))
    assert result.card.context == CONTEXT
    assert result.card.topic == req.topic
    for field in ("data", "contact", "success_criteria", "constraints", "users"):
        assert getattr(result.card, field) is None
    assert req.model_dump() == original


@pytest.mark.parametrize(
    "field,value",
    [
        ("data", "CRM database"),
        ("contact", "director@example.com"),
        ("success_criteria", "Сократить время на 30%"),
        ("constraints", "2 недели"),
    ],
)
def test_invented_facts_are_rejected(field, value):
    output = BuildCardResponse(card=card(**{field: value}))
    ai, parse = service(output, output)
    with pytest.raises(AIServiceError, match="Не удалось"):
        asyncio.run(ai.build(request()))
    assert parse.await_count == 2


def test_question_is_not_factual_evidence():
    req = request()
    req.questions[0].text = "Есть ли CRM database?"
    output = BuildCardResponse(card=card(data="CRM database"))
    ai, _ = service(output, output)
    with pytest.raises(AIServiceError):
        asyncio.run(ai.build(req))


@pytest.mark.parametrize(
    "mutation",
    [
        lambda d: d["answers"][0].update(question_id="unknown"),
        lambda d: d["answers"].append(d["answers"][0]),
        lambda d: d["questions"].append(d["questions"][0]),
        lambda d: d["answers"][0].update(answer="  "),
    ],
)
def test_invalid_answer_mapping(mutation):
    data = request().model_dump()
    mutation(data)
    with pytest.raises(ValidationError):
        BuildCardRequest.model_validate(data)


def test_fully_known_card_does_not_create_fake_questions():
    output = ModelAnalysis(
        card=card(**dict.fromkeys(TaskCard.model_fields, "fact")), questions=[]
    )
    ai, parse = service(output)
    with pytest.raises(AIServiceError) as error:
        asyncio.run(ai.analyze(AnalyzeDraftRequest(draft="fact")))
    assert error.value.status == 409
    assert parse.await_count == 1


def test_http_without_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with TestClient(app) as client:
        response = client.post("/api/ai/analyze-draft", json={"draft": DRAFT})
        assert response.status_code == 200
        assert response.headers["X-AI-Fallback"] == "true"
        assert len(response.json()["questions"]) >= 3
        assert (
            client.post("/api/ai/analyze-draft", json={"draft": " "}).status_code == 422
        )
        response = client.post("/api/ai/build-card", json=request().model_dump())
        assert response.status_code == 503
        assert response.json()["error"]["retryable"] is True
        assert "api_key" not in response.text.lower()


def test_http_build_success():
    ai, _ = service(BuildCardResponse(card=card(need=DRAFT, context=CONTEXT)))
    app.dependency_overrides[get_ai_service] = lambda: ai
    try:
        with TestClient(app) as client:
            response = client.post("/api/ai/build-card", json=request().model_dump())
        assert response.status_code == 200
        assert response.json()["card"]["data"] is None
    finally:
        app.dependency_overrides.clear()


@pytest.mark.parametrize("malformed_first", [False, True])
def test_real_sdk_with_mock_http_transport(malformed_first):
    """Exercise the SDK parser and actual wire schema without network or credentials."""
    calls = []

    def handler(req):
        body = json.loads(req.content)
        calls.append(body)
        schema = body["text"]["format"]["schema"]
        assert schema["additionalProperties"] is False
        assert set(schema["$defs"]["TaskCard"]["required"]) == set(
            TaskCard.model_fields
        )
        return httpx.Response(
            200,
            json={
                "id": "resp_test",
                "object": "response",
                "created_at": 0,
                "model": "test-model",
                "status": "completed",
                "output": [
                    {
                        "id": "msg_test",
                        "type": "message",
                        "role": "assistant",
                        "status": "completed",
                        "content": [
                            {
                                "type": "output_text",
                                "text": "{broken"
                                if malformed_first and len(calls) == 1
                                else analysis().model_dump_json(),
                                "annotations": [],
                            }
                        ],
                    }
                ],
            },
        )

    async def run():
        async with AsyncOpenAI(
            api_key="test-only",
            max_retries=0,
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        ) as client:
            return await AIService(client, "test-model").analyze(
                AnalyzeDraftRequest(draft=DRAFT)
            )

    result, fallback = asyncio.run(run())
    assert not fallback and result.known_fields["need"] == DRAFT
    assert len(calls) == (2 if malformed_first else 1)


def test_total_timeout_cancels_slow_provider(monkeypatch):
    from app.services import ai_service

    monkeypatch.setattr(ai_service, "TIMEOUT_SECONDS", 0.01)

    async def slow(**kwargs):
        await asyncio.sleep(5)

    parse = AsyncMock(side_effect=slow)
    ai = AIService(
        SimpleNamespace(responses=SimpleNamespace(parse=parse)), "test-model"
    )
    _, fallback = asyncio.run(ai.analyze(AnalyzeDraftRequest(draft=DRAFT)))
    assert fallback and parse.await_count == 1
