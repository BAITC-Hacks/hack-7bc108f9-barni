import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import tasks
from app.schemas.task import TaskCreate, TaskOut

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
DB = Annotated[Session, Depends(get_db)]


def not_found() -> HTTPException:
    return HTTPException(404, {"code": "TASK_NOT_FOUND", "message": "Задача не найдена"})


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreate, db: DB):
    return tasks.create(db, body.draft_text, body.topic)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: uuid.UUID, db: DB):
    task = tasks.get(db, task_id)
    if task is None:
        raise not_found()
    return task
