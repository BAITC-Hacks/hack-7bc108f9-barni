import copy
import json
import logging
import uuid

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import Proposal, Task, Team
from app.seed import DEFAULT_PATH, load

MIGRATION_TEAMS = {
    "Team Alpha": uuid.UUID("00000000-0000-4000-8000-000000000001"),
    "Team Beta": uuid.UUID("00000000-0000-4000-8000-000000000002"),
    "Team Gamma": uuid.UUID("00000000-0000-4000-8000-000000000003"),
}


@pytest.fixture(scope="module")
def seed_data() -> dict:
    if not DEFAULT_PATH.exists():
        pytest.skip(f"{DEFAULT_PATH} is not available")
    return json.loads(DEFAULT_PATH.read_text(encoding="utf-8"))


@pytest.fixture
def db(engine):
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE proposals, tasks"))
        connection.execute(
            text("DELETE FROM teams WHERE id <> ALL(:ids)"),
            {"ids": list(MIGRATION_TEAMS.values())},
        )
    with Session(engine) as session:
        yield session


def count(db: Session, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def published(db: Session) -> list[Task]:
    return list(
        db.scalars(
            select(Task)
            .where(Task.status == "published")
            .order_by(Task.score.desc(), Task.published_at.desc())
        )
    )


def test_seed_gives_the_five_demo_levels(db, seed_data):
    counts = load(db, seed_data)
    assert counts == {"tasks": 5, "proposals": 5, "skipped": 0}
    tasks = published(db)
    assert [task.score for task in tasks] == [95, 80, 65, 45, 25]
    assert [task.readiness_level for task in reversed(tasks)] == [
        "draft", "working", "working", "ready", "priority",
    ]
    for task in tasks:
        assert sum(item["earned"] for item in task.score_breakdown) == task.score
        assert task.confirmed_at is not None
        assert task.published_at is not None
        assert task.topic == "education"


def test_seed_score_comes_from_calculate_score_not_json(db, seed_data):
    data = copy.deepcopy(seed_data)
    for record in data["tasks"]:
        record["score"] = 7
        record["readiness_level"] = "priority"
    load(db, data)
    assert [task.score for task in published(db)] == [95, 80, 65, 45, 25]


def test_seed_does_not_duplicate_migration_teams(db, seed_data):
    load(db, seed_data)
    teams = {team.name: team.id for team in db.scalars(select(Team))}
    for name, team_id in MIGRATION_TEAMS.items():
        assert teams[name] == team_id
    assert len(teams) == len(MIGRATION_TEAMS) + len(
        {t["name"] for t in seed_data["teams"]} - MIGRATION_TEAMS.keys()
    )
    alpha_seed_id = next(t["id"] for t in seed_data["teams"] if t["name"] == "Team Alpha")
    alpha_proposals = [p for p in seed_data["proposals"] if p["team_id"] == alpha_seed_id]
    assert db.scalar(
        select(func.count()).where(Proposal.team_id == MIGRATION_TEAMS["Team Alpha"])
    ) == len(alpha_proposals)


def test_second_start_duplicates_nothing(db, seed_data):
    load(db, seed_data)
    before = (count(db, Task), count(db, Team), count(db, Proposal))
    assert load(db, seed_data) == {"tasks": 0, "proposals": 0, "skipped": 0}
    assert (count(db, Task), count(db, Team), count(db, Proposal)) == before


def test_russian_topic_label_is_translated(db, seed_data):
    data = copy.deepcopy(seed_data)
    data["tasks"][0]["topic"] = "Автоматизация"
    data["tasks"][0]["card"]["topic"] = "Автоматизация"
    load(db, data)
    task = db.get(Task, uuid.UUID(data["tasks"][0]["id"]))
    assert task.topic == "automation"
    assert task.card["topic"] == "automation"


def test_unknown_topic_skips_only_that_record(db, seed_data, caplog):
    data = copy.deepcopy(seed_data)
    data["tasks"][1]["topic"] = "Космос"
    data["tasks"][1]["card"]["topic"] = "Космос"
    with caplog.at_level(logging.ERROR, logger="seed"):
        counts = load(db, data)
    assert counts["tasks"] == 4
    skipped_task = data["tasks"][1]["id"]
    assert db.get(Task, uuid.UUID(skipped_task)) is None
    assert any("Космос" in message for message in caplog.messages)
    orphan = [p for p in data["proposals"] if p["task_id"] == skipped_task]
    assert counts["proposals"] == len(data["proposals"]) - len(orphan)
