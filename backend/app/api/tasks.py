import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Task
from app.repositories import tasks
from app.schemas.task import CardBody, TaskCreate, TaskDetail
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
