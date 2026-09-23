"""Loads data/seed.json when the catalog has no published tasks.

Run as `python -m app.seed` (the container does it on start). Bad records are logged
and skipped; the loader never fails the start. Scores always come from calculate_score.
"""

import json
import logging
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Proposal, Task, Team
from app.schemas.proposal import ProposalCreate
from app.schemas.task import TOPICS, ConfirmCard
from app.services.rating_service import calculate_score

logger = logging.getLogger("seed")

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "seed.json"
TOPIC_SLUGS = {topic["slug"]: topic["slug"] for topic in TOPICS} | {
    topic["label"].casefold(): topic["slug"] for topic in TOPICS
}


class SkipRecord(Exception):
    pass


def topic_slug(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    slug = TOPIC_SLUGS.get(value.strip()) or TOPIC_SLUGS.get(value.strip().casefold())
    if slug is None:
        raise SkipRecord(f"неизвестная тема {value!r}")
    return slug


def has_published_tasks(db: Session) -> bool:
    return db.scalar(select(exists().where(Task.status == "published")))


def load_teams(db: Session, teams: list[dict]) -> dict[str, uuid.UUID]:
    """Seed team id -> database team id. Existing teams are matched by name."""
    by_name = {team.name.casefold(): team for team in db.scalars(select(Team))}
    mapping: dict[str, uuid.UUID] = {}
    for record in teams:
        name = (record.get("name") or "").strip()
        if not name:
            logger.error("Команда %s пропущена: нет имени", record.get("id"))
            continue
        existing = by_name.get(name.casefold())
        if existing is None:
            existing = Team(
                id=uuid.UUID(record["id"]) if record.get("id") else uuid.uuid4(),
                name=name,
                interests=record.get("interests") or [],
                skills=record.get("skills") or [],
                technologies=record.get("technologies") or [],
                points=record.get("points") or 0,
            )
            db.add(existing)
            db.flush()
            by_name[name.casefold()] = existing
        if record.get("id"):
            mapping[str(record["id"])] = existing.id
    return mapping


def build_task(record: dict, published_at: datetime) -> Task:
    topic = topic_slug(record.get("topic") or (record.get("card") or {}).get("topic"))
    card = ConfirmCard.model_validate({**(record.get("card") or {}), "topic": topic})
    task_card = card.to_task_card()
    task = Task(
        id=uuid.UUID(record["id"]) if record.get("id") else uuid.uuid4(),
        draft_text=(record.get("draft_text") or task_card.need or task_card.title or "").strip(),
        title=task_card.title,
        topic=topic,
        card=task_card.model_dump(),
        status="draft",
    )
    if not task.draft_text:
        raise SkipRecord("нет draft_text")
    if record.get("status") == "published":
        result = calculate_score(task_card)
        task.score = result.score
        task.readiness_level = result.readiness_level
        task.score_breakdown = [item.model_dump() for item in result.breakdown]
        task.missing_fields = [item.model_dump() for item in result.missing_fields]
        task.confirmed_at = published_at
        task.published_at = published_at
        task.status = "published"
    return task


def build_proposal(
    record: dict, task_ids: set[uuid.UUID], team_ids: dict[str, uuid.UUID]
) -> Proposal:
    task_id = uuid.UUID(str(record.get("task_id")))
    if task_id not in task_ids:
        raise SkipRecord("задача не загружена")
    team_id = team_ids.get(str(record.get("team_id")))
    if team_id is None:
        raise SkipRecord("команда не найдена")
    body = ProposalCreate.model_validate(
        {
            "team_id": team_id,
            "idea": record.get("idea"),
            "plan": record.get("plan"),
            "estimated_duration": record.get("estimated_duration"),
            "prototype_url": record.get("prototype_url"),
        }
    )
    status = record.get("status") or "pending"
    if status not in ("pending", "accepted", "rejected"):
        raise SkipRecord(f"неизвестный статус {status!r}")
    return Proposal(
        id=uuid.UUID(record["id"]) if record.get("id") else uuid.uuid4(),
        task_id=task_id,
        status=status,
        **body.model_dump(),
    )


def load(db: Session, data: dict) -> dict[str, int]:
    counts = {"tasks": 0, "proposals": 0, "skipped": 0}
    if has_published_tasks(db):
        logger.info("Seed пропущен: в каталоге уже есть опубликованные задачи")
        return counts
    team_ids = load_teams(db, data.get("teams") or [])

    task_ids: set[uuid.UUID] = set()
    records = data.get("tasks") or []
    now = datetime.now(UTC)
    for index, record in enumerate(records):
        # Earlier records get earlier publication times, so ties keep file order stable.
        published_at = now - timedelta(seconds=len(records) - index)
        try:
            with db.begin_nested():
                task = build_task(record, published_at)
                db.add(task)
                db.flush()
        except (SkipRecord, ValidationError, ValueError, KeyError) as error:
            logger.error("Задача %s пропущена: %s", record.get("id"), short(error))
            counts["skipped"] += 1
            continue
        task_ids.add(task.id)
        counts["tasks"] += 1

    for record in data.get("proposals") or []:
        try:
            with db.begin_nested():
                db.add(build_proposal(record, task_ids, team_ids))
                db.flush()
        except (SkipRecord, ValidationError, ValueError, KeyError) as error:
            logger.error("Предложение %s пропущено: %s", record.get("id"), short(error))
            counts["skipped"] += 1
            continue
        counts["proposals"] += 1

    db.commit()
    logger.info(
        "Seed загружен: задач %(tasks)s, предложений %(proposals)s, пропущено %(skipped)s",
        counts,
    )
    return counts


def short(error: Exception) -> str:
    if isinstance(error, ValidationError):
        first = error.errors()[0]
        return f"{'.'.join(map(str, first['loc']))}: {first['msg']}"
    return str(error)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s [seed] %(message)s")
    path = Path(os.getenv("SEED_PATH") or DEFAULT_PATH)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        logger.error("Seed не загружен: не удалось прочитать %s: %s", path, error)
        return 0
    try:
        with SessionLocal() as db:
            load(db, data)
            logger.info(
                "Опубликованных задач: %s",
                db.scalar(select(func.count()).where(Task.status == "published")),
            )
    except Exception:
        logger.exception("Seed не загружен")
    return 0


if __name__ == "__main__":
    sys.exit(main())
