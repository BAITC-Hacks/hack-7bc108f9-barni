from fastapi import APIRouter

from app.schemas.task import CardBody, ScoreResult
from app.services.rating_service import calculate_score

router = APIRouter(prefix="/api/rating", tags=["rating"])


@router.post("/preview", response_model=ScoreResult)
def preview(body: CardBody):
    return calculate_score(body.card.to_task_card())
