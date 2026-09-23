import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.schemas.ai import TaskCard

TopicSlug = Literal["automation", "analytics", "marketing", "education", "finance", "other"]
ReadinessSlug = Literal["draft", "working", "ready", "priority"]

TOPICS = [
    {"slug": "automation", "label": "Автоматизация"},
    {"slug": "analytics", "label": "Аналитика"},
    {"slug": "marketing", "label": "Маркетинг"},
    {"slug": "education", "label": "Образование"},
    {"slug": "finance", "label": "Финансы"},
    {"slug": "other", "label": "Другое"},
]
READINESS_LEVELS = [
    {"slug": "draft", "label": "Черновик", "min": 0, "max": 39},
    {"slug": "working", "label": "Рабочая", "min": 40, "max": 69},
    {"slug": "ready", "label": "Готовая", "min": 70, "max": 89},
    {"slug": "priority", "label": "Приоритетная", "min": 90, "max": 100},
]


class Topic(BaseModel):
    slug: TopicSlug
    label: str


class ReadinessLevel(BaseModel):
    slug: ReadinessSlug
    label: str
    min: int
    max: int


class MetaOut(BaseModel):
    topics: list[Topic]
    readiness_levels: list[ReadinessLevel]


class TeamOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    interests: list[str]
    skills: list[str]
    technologies: list[str]
    points: int


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    draft_text: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20000)
    ]
    topic: TopicSlug | None = None


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Literal["draft", "published"]
    draft_text: str
    title: str | None
    topic: TopicSlug | None
    card: TaskCard
    score: int | None = Field(ge=0, le=100)
    readiness_level: ReadinessSlug | None
    score_breakdown: list[dict] | None
    missing_fields: list[dict] | None
    confirmed_at: datetime | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
