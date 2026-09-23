import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published')", name="ck_tasks_status"),
        CheckConstraint(
            "readiness_level IS NULL OR readiness_level IN "
            "('draft', 'working', 'ready', 'priority')",
            name="ck_tasks_readiness_level",
        ),
        CheckConstraint(
            "topic IS NULL OR topic IN ('automation', 'analytics', 'marketing', "
            "'education', 'finance', 'other')",
            name="ck_tasks_topic",
        ),
        CheckConstraint("score IS NULL OR score BETWEEN 0 AND 100", name="ck_tasks_score"),
        Index("ix_tasks_status_score", "status", "score", postgresql_ops={"score": "DESC"}),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    draft_text: Mapped[str] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(Text)
    card: Mapped[dict] = mapped_column(JSONB)
    score: Mapped[int | None] = mapped_column(Integer)
    readiness_level: Mapped[str | None] = mapped_column(Text)
    score_breakdown: Mapped[list | None] = mapped_column(JSONB)
    missing_fields: Mapped[list | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(Text, default="draft", server_default="draft")
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
