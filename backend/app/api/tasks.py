import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Task
from app.repositories import tasks
from app.schemas.ai import TopicSlug
from app.schemas.task import (
    CONTEXT_PREVIEW_LENGTH,
    CardBody,
    ReadinessSlug,
    TaskCreate,
    TaskDetail,
    TaskSummary,
)
from app.services.rating_service import calculate_score

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
DB = Annotated[Session, Depends(get_db)]


def get_or_404(db: Session, task_id: uuid.UUID) -> Task:
    task = tasks.get(db, task_id)
    if task is None:
        raise HTTPException(
            404, {"code": "TASK_NOT_FOUND", "message": "Задача не найдена"}
        )
    return task


def to_detail(db: Session, task: Task) -> TaskDetail:
    fields = {column.name: getattr(task, column.name) for column in Task.__table__.columns}
    return TaskDetail.model_validate(
        {**fields, "proposals_count": tasks.proposals_count(db, task.id)}
    )


@router.post("", response_model=TaskDetail, status_code=201)
def create_task(body: TaskCreate, db: DB):
    return to_detail(db, tasks.create(db, body.draft_text, body.topic))


def preview(text: str | None) -> str | None:
    if text is None or len(text) <= CONTEXT_PREVIEW_LENGTH:
        return text
    return text[: CONTEXT_PREVIEW_LENGTH - 1].rstrip() + "…"


@router.get("", response_model=list[TaskSummary])
def list_tasks(
    db: DB,
    status: Annotated[Literal["draft", "published"], Query()] = "published",
    topic: Annotated[TopicSlug | None, Query()] = None,
    readiness: Annotated[ReadinessSlug | None, Query()] = None,
    sort: Annotated[Literal["score_desc"], Query()] = "score_desc",
):
    return [
        TaskSummary(
            id=task.id,
            title=task.title,
            topic=task.topic,
            context_preview=preview(task.card.get("context")),
            score=task.score,
            readiness_level=task.readiness_level,
            missing_fields=task.missing_fields,
            status=task.status,
            published_at=task.published_at,
            proposals_count=count,
        )
        for task, count in tasks.catalog(db, status, topic, readiness)
    ]


@router.get("/{task_id}", response_model=TaskDetail)
def get_task(task_id: uuid.UUID, db: DB):
    return to_detail(db, get_or_404(db, task_id))


@router.put("/{task_id}/confirm", response_model=TaskDetail)
def confirm_task(task_id: uuid.UUID, body: CardBody, db: DB):
    task = get_or_404(db, task_id)
    card = body.card.to_task_card()
    result = calculate_score(card)
    if sum(item.earned for item in result.breakdown) != result.score:
        raise RuntimeError("Rating breakdown does not add up to the score")
    return to_detail(db, tasks.confirm(db, task, card, result))


@router.post("/{task_id}/publish", response_model=TaskDetail)
def publish_task(task_id: uuid.UUID, db: DB):
    task = get_or_404(db, task_id)
    if task.confirmed_at is None:
        raise HTTPException(
            409,
            {
                "code": "TASK_NOT_CONFIRMED",
                "message": "Сначала подтвердите карточку задачи",
            },
        )
    return to_detail(db, tasks.publish(db, task))
