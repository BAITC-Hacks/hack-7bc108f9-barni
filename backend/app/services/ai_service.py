import asyncio
import json
import logging
import os
from collections.abc import Callable
from typing import TypeVar

from openai import NOT_GIVEN, APIError, AsyncOpenAI
from pydantic import BaseModel

from app.schemas.ai import (
    AnalyzeDraftRequest,
    AnalyzeDraftResponse,
    BuildCardRequest,
    BuildCardResponse,
    ModelAnalysis,
    Question,
    TaskCard,
)
from app.services.ai_prompts import (
    ANALYZE_DRAFT_PROMPT,
    BUILD_CARD_PROMPT,
    SYSTEM_PROMPT,
)

T = TypeVar("T", bound=BaseModel)
TIMEOUT_SECONDS = 20
logger = logging.getLogger(__name__)
QUESTIONS = {
    "context": "Как сейчас устроен процесс, который вы хотите изменить?",
    "need": "Какую проблему нужно решить?",
    "data": "Какие данные или материалы вы сможете предоставить команде?",
    "expected_result": "Какой конкретный результат должна подготовить команда?",
    "success_criteria": "По каким измеримым признакам вы поймёте, что результат успешен?",
    "constraints": "Есть ли ограничения по срокам, технологиям или доступам?",
    "users": "Кто будет пользоваться результатом?",
    "contact": "Кто со стороны бизнеса сможет консультировать команду?",
    "interaction_format": "Какой формат консультаций и обратной связи вы можете предоставить?",
    "title": "Как назвать задачу?",
    "topic": "К какой теме относится задача?",
}


class AIServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 503):
        self.code = code
        self.message = message
        self.status = status
        super().__init__(message)


def ground_card(card: TaskCard, request: AnalyzeDraftRequest) -> TaskCard:
    """Reject generated facts. Questions are deliberately excluded as evidence."""
    sources = [request.draft]
    if isinstance(request, BuildCardRequest):
        sources.extend(answer.answer for answer in request.answers)
    values = card.model_dump()
    for field, value in values.items():
        allowed = sources + (
            [request.topic] if field == "topic" and request.topic else []
        )
        if value is not None and not any(value in source for source in allowed):
            raise ValueError("Card contains unsupported facts")
    if request.topic is not None:
        values["topic"] = request.topic
    return TaskCard.model_validate(values)


def analysis_from_card(
    card: TaskCard, questions: list[Question]
) -> AnalyzeDraftResponse:
    values = card.model_dump()
    missing = [key for key, value in values.items() if value is None]
    if len(missing) < 3:
        raise AIServiceError(
            "insufficient_missing_fields",
            "Недостающих полей меньше трёх. Перейдите к сборке карточки.",
            409,
        )
    return AnalyzeDraftResponse(
        known_fields={key: value for key, value in values.items() if value is not None},
        missing_fields=missing,
        questions=questions,
    )


def fallback_analysis(request: AnalyzeDraftRequest) -> AnalyzeDraftResponse:
    # No semantic extraction is claimed offline; only explicit topic is known.
    card = TaskCard.model_validate(dict.fromkeys(TaskCard.model_fields))
    card.topic = request.topic
    questions = [
        Question(id=f"q{i}", target_field=field, text=text)
        for i, (field, text) in enumerate(QUESTIONS.items(), 1)
        if getattr(card, field) is None
    ][:5]
    return analysis_from_card(card, questions)


class AIService:
    def __init__(self, client: AsyncOpenAI | None, model: str):
        self.client = client
        self.model = model

    async def _generate(
        self,
        request: AnalyzeDraftRequest,
        schema: type[T],
        prompt: str,
        validate: Callable[[T], T],
    ) -> T:
        if self.client is None:
            raise AIServiceError("ai_unavailable", "AI недоступен. Повторите позже.")
        for attempt in range(2):
            try:
                async with asyncio.timeout(TIMEOUT_SECONDS):
                    response = await self.client.responses.parse(
                        model=self.model,
                        reasoning={"effort": "low"}
                        if self.model == "gpt-5-mini"
                        or self.model.startswith("gpt-5-mini-")
                        else NOT_GIVEN,
                        instructions=SYSTEM_PROMPT
                        + prompt
                        + (
                            "\nPrevious output failed validation. Check schema and grounding."
                            if attempt
                            else ""
                        ),
                        input=json.dumps(request.model_dump(), ensure_ascii=False),
                        text_format=schema,
                        store=False,
                        max_output_tokens=4000,
                    )
                if response.status != "completed" or response.output_parsed is None:
                    raise ValueError("Missing or incomplete structured output")
                parsed = schema.model_validate(response.output_parsed.model_dump())
                return validate(parsed)
            except ValueError:
                if attempt == 1:
                    raise AIServiceError(
                        "ai_invalid_output",
                        "Не удалось обработать ответ AI. Повторите запрос.",
                    ) from None
            except (APIError, TimeoutError) as error:
                # Never log provider bodies, credentials, drafts or answers.
                logger.warning(
                    "AI provider failure: %s status=%s",
                    type(error).__name__,
                    getattr(error, "status_code", None),
                )
                raise AIServiceError(
                    "ai_unavailable", "AI временно недоступен. Повторите запрос."
                ) from None
        raise AssertionError("Unreachable")

    async def analyze(
        self, request: AnalyzeDraftRequest
    ) -> tuple[AnalyzeDraftResponse, bool]:
        def validate(result: ModelAnalysis) -> ModelAnalysis:
            result.card = ground_card(result.card, request)
            analysis_from_card(result.card, result.questions)
            return result

        try:
            result = await self._generate(
                request, ModelAnalysis, ANALYZE_DRAFT_PROMPT, validate
            )
            return analysis_from_card(result.card, result.questions), False
        except AIServiceError as error:
            if error.status == 409:
                raise
            return fallback_analysis(request), True

    async def build(self, request: BuildCardRequest) -> BuildCardResponse:
        def validate(result: BuildCardResponse) -> BuildCardResponse:
            result.card = ground_card(result.card, request)
            return result

        return await self._generate(
            request, BuildCardResponse, BUILD_CARD_PROMPT, validate
        )


async def get_ai_service():
    # Lazy initialization lets the backend start and analyze offline without a key.
    key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
    if not key:
        yield AIService(None, model)
        return
    async with AsyncOpenAI(
        api_key=key, timeout=TIMEOUT_SECONDS, max_retries=0
    ) as client:
        yield AIService(client, model)
