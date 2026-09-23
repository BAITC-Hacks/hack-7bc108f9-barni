"""tasks, teams, proposals + demo teams

Revision ID: 0001
Revises:
Create Date: 2026-09-23
"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Temporary seed so the role switcher works; data/seed.json from №3 replaces it.
DEMO_TEAMS = [
    {
        "id": "00000000-0000-4000-8000-000000000001",
        "name": "Team Alpha",
        "interests": ["automation", "analytics"],
        "skills": ["Python", "React"],
        "technologies": ["FastAPI", "PostgreSQL"],
    },
    {
        "id": "00000000-0000-4000-8000-000000000002",
        "name": "Team Beta",
        "interests": ["marketing", "education"],
        "skills": ["UX", "TypeScript"],
        "technologies": ["React", "Figma"],
    },
    {
        "id": "00000000-0000-4000-8000-000000000003",
        "name": "Team Gamma",
        "interests": ["finance", "other"],
        "skills": ["Data analysis", "ML"],
        "technologies": ["Pandas", "Jupyter"],
    },
]


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "tasks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("draft_text", sa.Text(), nullable=False),
        sa.Column("title", sa.Text()),
        sa.Column("topic", sa.Text()),
        sa.Column("card", JSONB(), nullable=False),
        sa.Column("score", sa.Integer()),
        sa.Column("readiness_level", sa.Text()),
        sa.Column("score_breakdown", JSONB()),
        sa.Column("missing_fields", JSONB()),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("published_at", sa.DateTime(timezone=True)),
        *timestamps(),
        sa.CheckConstraint("status IN ('draft', 'published')", name="ck_tasks_status"),
        sa.CheckConstraint(
            "readiness_level IS NULL OR readiness_level IN "
            "('draft', 'working', 'ready', 'priority')",
            name="ck_tasks_readiness_level",
        ),
        sa.CheckConstraint(
            "topic IS NULL OR topic IN ('automation', 'analytics', 'marketing', "
            "'education', 'finance', 'other')",
            name="ck_tasks_topic",
        ),
        sa.CheckConstraint("score IS NULL OR score BETWEEN 0 AND 100", name="ck_tasks_score"),
    )
    op.create_index(
        "ix_tasks_status_score", "tasks", ["status", sa.text("score DESC")]
    )

    teams = op.create_table(
        "teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("interests", JSONB(), server_default="[]", nullable=False),
        sa.Column("skills", JSONB(), server_default="[]", nullable=False),
        sa.Column("technologies", JSONB(), server_default="[]", nullable=False),
        sa.Column("points", sa.Integer(), server_default="0", nullable=False),
    )

    op.create_table(
        "proposals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team_id", UUID(as_uuid=True), sa.ForeignKey("teams.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idea", sa.Text(), nullable=False),
        sa.Column("plan", sa.Text(), nullable=False),
        sa.Column("estimated_duration", sa.Text(), nullable=False),
        sa.Column("prototype_url", sa.Text()),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        *timestamps(),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected')", name="ck_proposals_status"
        ),
    )
    op.create_index("ix_proposals_task_id", "proposals", ["task_id"])
    op.create_index("ix_proposals_team_id", "proposals", ["team_id"])

    op.bulk_insert(teams, [{**team, "id": uuid.UUID(team["id"]), "points": 0} for team in DEMO_TEAMS])


def downgrade() -> None:
    op.drop_table("proposals")
    op.drop_table("teams")
    op.drop_table("tasks")
