from typing import Annotated, get_args

from fastapi import APIRouter, Depends, HTTPException, Response

from app.schemas.ai import (
    AnalyzeDraftOut,
    AnalyzeDraftRequest,
    BuildCardOut,
    BuildCardRequest,
    TopicSlug,
)
from app.services.ai_service import AIService, AIServiceError, get_ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])
Service = Annotated[AIService, Depends(get_ai_service)]
TOPIC_SLUGS = set(get_args(TopicSlug))


def http_error(error: AIServiceError) -> HTTPException:
    return HTTPException(
        status_code=error.status,
        detail={
            "code": error.code.upper(),
            "message": error.message,
            "retryable": error.status == 503,
        },
    )


@router.post("/analyze-draft", response_model=AnalyzeDraftOut)
async def analyze_draft(
    request: AnalyzeDraftRequest, response: Response, service: Service
):
    try:
        result, fallback = await service.analyze(request)
    except AIServiceError as error:
        raise http_error(error) from None
    response.headers["X-AI-Fallback"] = str(fallback).lower()
    known = dict(result.known_fields)
    missing = list(result.missing_fields)
    # Without an explicit topic the model may quote free text; only slugs are valid.
    if "topic" in known and known["topic"] not in TOPIC_SLUGS:
        del known["topic"]
        missing.append("topic")
    return AnalyzeDraftOut(
        known_fields=known,
        missing_fields=missing,
        questions=result.questions,
        source="fallback" if fallback else "model",
    )


@router.post("/build-card", response_model=BuildCardOut)
async def build_card(request: BuildCardRequest, service: Service):
    try:
        result = await service.build(request)
    except AIServiceError as error:
        raise http_error(error) from None
    card = result.card.model_copy()
    if card.topic not in TOPIC_SLUGS:
        card.topic = None
    return BuildCardOut(card=card, source="model")
