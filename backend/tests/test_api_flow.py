"""API tests against a real PostgreSQL: a separate <db>_test database, migrated by Alembic."""

import os
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.db import DATABASE_URL, get_db
from app.main import app

ALPHA = "00000000-0000-4000-8000-000000000001"
BETA = "00000000-0000-4000-8000-000000000002"
GAMMA = "00000000-0000-4000-8000-000000000003"
MISSING = "00000000-0000-0000-0000-000000000000"
FIELD_TEXT = "Заполнено тремя словами"
# Scores: context/need 10, data 20 → 40 (working); + expected_result, success_criteria → 70.
WORKING = ("context", "need", "data")
READY = (*WORKING, "expected_result", "success_criteria")
FULL = (*READY, "constraints", "users", "contact", "interaction_format")


@pytest.fixture(scope="module")
def engine():
    base = make_url(DATABASE_URL)
    test_url = base.set(database=f"{base.database}_test")
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as connection:
            connection.execute(text(f'DROP DATABASE IF EXISTS "{test_url.database}" WITH (FORCE)'))
            connection.execute(text(f'CREATE DATABASE "{test_url.database}"'))
    except Exception as error:  # noqa: BLE001
        pytest.skip(f"PostgreSQL is not reachable: {error}")
    finally:
        admin.dispose()
    url = test_url.render_as_string(hide_password=False)
    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, "DATABASE_URL": url},
        check=True,
        capture_output=True,
    )
    engine = create_engine(url)
    yield engine
    engine.dispose()


@pytest.fixture
def client(engine):
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE proposals, tasks"))
    Session = sessionmaker(bind=engine, expire_on_commit=False)

    def override():
        with Session() as session:
            yield session

    app.dependency_overrides[get_db] = override
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def card(*filled: str, topic: str = "automation", title: str = "Задача") -> dict:
    data = {field: FIELD_TEXT for field in filled}
    return {"card": {"title": title, "topic": topic, **data}}


def new_task(client, *filled: str, topic: str = "automation", title: str = "Задача",
             publish: bool = True) -> str:
    task_id = client.post(
        "/api/tasks", json={"draft_text": "Черновик задачи", "topic": topic}
    ).json()["id"]
    if filled or publish:
        response = client.put(
            f"/api/tasks/{task_id}/confirm", json=card(*filled, topic=topic, title=title)
        )
        assert response.status_code == 200
    if publish:
        assert client.post(f"/api/tasks/{task_id}/publish").status_code == 200
    return task_id


def catalog_ids(client, **params) -> list[str]:
    response = client.get("/api/tasks", params=params)
    assert response.status_code == 200
    return [item["id"] for item in response.json()]


def propose(client, task_id: str, team_id: str, **extra):
    body = {
        "team_id": team_id,
        "idea": "Чат-бот для заявок",
        "plan": "Неделя на прототип",
        "estimated_duration": "2 недели",
        **extra,
    }
    return client.post(f"/api/tasks/{task_id}/proposals", json=body)


def test_unconfirmed_task_is_not_published(client):
    task_id = new_task(client, publish=False)
    response = client.post(f"/api/tasks/{task_id}/publish")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TASK_NOT_CONFIRMED"
    assert client.get(f"/api/tasks/{task_id}").json()["status"] == "draft"
    assert catalog_ids(client) == []


def test_publish_is_idempotent_and_sets_published_at(client):
    task_id = new_task(client, *WORKING)
    first = client.post(f"/api/tasks/{task_id}/publish").json()
    second = client.post(f"/api/tasks/{task_id}/publish").json()
    assert first["status"] == "published"
    assert first["published_at"] is not None
    assert first["published_at"] == second["published_at"]


def test_publish_unknown_task_is_404(client):
    response = client.post(f"/api/tasks/{MISSING}/publish")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "TASK_NOT_FOUND"


def test_reconfirm_with_fuller_card_moves_task_up(client):
    low = new_task(client, "context", title="Слабая")
    high = new_task(client, *READY, title="Сильная")
    assert catalog_ids(client) == [high, low]
    response = client.put(f"/api/tasks/{low}/confirm", json=card(*FULL, title="Слабая"))
    assert response.status_code == 200
    assert response.json()["status"] == "published"
    assert response.json()["score"] == 100
    assert catalog_ids(client) == [low, high]


def test_equal_score_newer_publication_first(client):
    older = new_task(client, *WORKING)
    newer = new_task(client, *WORKING)
    assert catalog_ids(client) == [newer, older]


def test_low_score_and_drafts(client):
    zero = new_task(client)
    draft = new_task(client, "context", publish=False)
    items = client.get("/api/tasks").json()
    assert [item["id"] for item in items] == [zero]
    assert items[0]["score"] == 0
    assert items[0]["readiness_level"] == "draft"
    assert catalog_ids(client, status="draft") == [draft]


def test_filters_by_topic_and_readiness(client):
    automation_ready = new_task(client, *READY, topic="automation")
    automation_working = new_task(client, *WORKING, topic="automation")
    finance_ready = new_task(client, *READY, topic="finance")
    assert catalog_ids(client, topic="automation") == [automation_ready, automation_working]
    assert catalog_ids(client, readiness="ready") == [finance_ready, automation_ready]
    assert catalog_ids(client, topic="finance", readiness="working") == []
    assert catalog_ids(client, topic="automation", readiness="working") == [automation_working]


@pytest.mark.parametrize(
    "params",
    [{"topic": "Автоматизация"}, {"readiness": "high"}, {"sort": "score_asc"}, {"status": "all"}],
)
def test_unknown_catalog_params_are_422(client, params):
    response = client.get("/api/tasks", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_catalog_item_shape(client):
    task_id = new_task(client, "context", "need")
    client.put(
        f"/api/tasks/{task_id}/confirm",
        json={"card": {"topic": "automation", "context": "слово " * 100}},
    )
    propose(client, task_id, ALPHA)
    (item,) = client.get("/api/tasks").json()
    assert set(item) == {
        "id", "title", "topic", "context_preview", "score", "readiness_level",
        "missing_fields", "status", "published_at", "proposals_count",
    }
    assert len(item["context_preview"]) <= 200
    assert item["proposals_count"] == 1


def test_several_proposals_accept_two_reject_one(client):
    task_id = new_task(client, *WORKING, title="Бот для заявок")
    ids = [propose(client, task_id, team).json()["id"] for team in (ALPHA, BETA, GAMMA)]
    assert propose(client, task_id, ALPHA).status_code == 201

    proposals = client.get(f"/api/tasks/{task_id}/proposals").json()
    assert [p["id"] for p in proposals][:3] == ids
    assert {p["status"] for p in proposals} == {"pending"}
    assert proposals[0]["team_name"] == "Team Alpha"
    assert proposals[0]["task_title"] == "Бот для заявок"
    assert client.get(f"/api/tasks/{task_id}").json()["proposals_count"] == 4

    for proposal_id, status in zip(ids, ("accepted", "accepted", "rejected"), strict=True):
        response = client.patch(f"/api/proposals/{proposal_id}", json={"status": status})
        assert response.status_code == 200
        assert response.json()["status"] == status

    statuses = [p["status"] for p in client.get(f"/api/tasks/{task_id}/proposals").json()]
    assert statuses == ["accepted", "accepted", "rejected", "pending"]


def test_repeated_decision_is_409(client):
    task_id = new_task(client, *WORKING)
    proposal_id = propose(client, task_id, ALPHA).json()["id"]
    assert client.patch(f"/api/proposals/{proposal_id}", json={"status": "accepted"}).status_code == 200
    for status in ("rejected", "accepted"):
        response = client.patch(f"/api/proposals/{proposal_id}", json={"status": status})
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "PROPOSAL_ALREADY_DECIDED"
    assert client.get(f"/api/tasks/{task_id}/proposals").json()[0]["status"] == "accepted"


def test_decision_errors(client):
    response = client.patch(f"/api/proposals/{MISSING}", json={"status": "accepted"})
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PROPOSAL_NOT_FOUND"
    task_id = new_task(client, *WORKING)
    proposal_id = propose(client, task_id, ALPHA).json()["id"]
    response = client.patch(f"/api/proposals/{proposal_id}", json={"status": "pending"})
    assert response.status_code == 422


def test_proposal_on_unpublished_task_is_409(client):
    task_id = new_task(client, *READY, publish=False)
    response = propose(client, task_id, ALPHA)
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "TASK_NOT_PUBLISHED"


def test_proposal_validation(client):
    task_id = new_task(client)
    assert propose(client, MISSING, ALPHA).json()["error"]["code"] == "TASK_NOT_FOUND"
    response = propose(client, task_id, MISSING)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "TEAM_NOT_FOUND"
    for extra in (
        {"idea": "   "},
        {"plan": "x" * 3001},
        {"estimated_duration": "x" * 101},
        {"prototype_url": "ftp://example.com"},
        {"prototype_url": "example.com"},
    ):
        assert propose(client, task_id, ALPHA, **extra).status_code == 422, extra
    ok = propose(client, task_id, ALPHA, prototype_url="https://example.com/demo").json()
    assert ok["prototype_url"] == "https://example.com/demo"
    assert propose(client, task_id, ALPHA, prototype_url="").json()["prototype_url"] is None


def test_team_sees_own_proposal_statuses(client):
    first = new_task(client, *WORKING, title="Первая")
    second = new_task(client, *WORKING, title="Вторая")
    accepted = propose(client, first, ALPHA).json()["id"]
    propose(client, second, ALPHA)
    propose(client, second, BETA)
    client.patch(f"/api/proposals/{accepted}", json={"status": "accepted"})

    mine = client.get("/api/proposals", params={"team_id": ALPHA}).json()
    assert [(p["task_title"], p["status"]) for p in mine] == [
        ("Первая", "accepted"),
        ("Вторая", "pending"),
    ]
    assert {p["team_id"] for p in mine} == {ALPHA}
    assert client.get("/api/proposals").status_code == 422
    assert client.get("/api/proposals", params={"team_id": MISSING}).status_code == 404
