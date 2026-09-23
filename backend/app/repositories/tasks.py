import uuid

from sqlalchemy.orm import Session

from app.models import Task
from app.schemas.ai import TaskCard


def create(db: Session, draft_text: str, topic: str | None) -> Task:
    card = dict.fromkeys(TaskCard.model_fields)
    card["topic"] = topic
    task = Task(draft_text=draft_text, topic=topic, card=card)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def get(db: Session, task_id: uuid.UUID) -> Task | None:
    return db.get(Task, task_id)
