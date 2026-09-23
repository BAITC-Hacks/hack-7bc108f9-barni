from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response

from app.schemas.ai import (
    AnalyzeDraftRequest,
    AnalyzeDraftResponse,
    BuildCardRequest,
    BuildCardResponse,
)
from app.services.ai_service import AIService, AIServiceError, get_ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])
Service = Annotated[AIService, Depends(get_ai_service)]


def http_error(error: AIServiceError) -> HTTPException:
    return HTTPException(
        status_code=error.status,
        detail={
            "code": error.code.upper(),
            "message": error.message,
            "retryable": error.status == 503,
        },
    )


@router.post("/analyze-draft", response_model=AnalyzeDraftResponse)
async def analyze_draft(
    request: AnalyzeDraftRequest, response: Response, service: Service
):
    try:
        result, fallback = await service.analyze(request)
        response.headers["X-AI-Fallback"] = str(fallback).lower()
        return result
    except AIServiceError as error:
        raise http_error(error) from None


@router.post("/build-card", response_model=BuildCardResponse)
async def build_card(request: BuildCardRequest, service: Service):
    try:
        return await service.build(request)
    except AIServiceError as error:
        raise http_error(error) from None
