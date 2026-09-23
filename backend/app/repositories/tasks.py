import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Proposal, Task
from app.schemas.ai import TaskCard
from app.schemas.task import ScoreResult


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


def confirm(db: Session, task: Task, card: TaskCard, result: ScoreResult) -> Task:
    task.card = card.model_dump()
    task.title = card.title
    task.topic = card.topic
    task.score = result.score
    task.readiness_level = result.readiness_level
    task.score_breakdown = [item.model_dump() for item in result.breakdown]
    task.missing_fields = [item.model_dump() for item in result.missing_fields]
    task.confirmed_at = datetime.now(UTC)
    db.commit()
    db.refresh(task)
    return task


def proposals_count(db: Session, task_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(Proposal).where(Proposal.task_id == task_id)
    )
