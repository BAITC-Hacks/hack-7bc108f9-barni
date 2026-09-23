import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints

from app.schemas.ai import CardField, TaskCard, TopicSlug

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


def blank_to_none(value):
    if isinstance(value, str) and not value.strip():
        return None
    return value.strip() if isinstance(value, str) else value


CardText = Annotated[str | None, BeforeValidator(blank_to_none)]


class ConfirmCard(BaseModel):
    """Card edited by the business: blank strings become null, topic must be a slug."""

    model_config = ConfigDict(extra="forbid")

    title: CardText = None
    topic: Annotated[TopicSlug | None, BeforeValidator(blank_to_none)] = None
    context: CardText = None
    need: CardText = None
    users: CardText = None
    data: CardText = None
    constraints: CardText = None
    expected_result: CardText = None
    success_criteria: CardText = None
    contact: CardText = None
    interaction_format: CardText = None

    def to_task_card(self) -> TaskCard:
        return TaskCard.model_validate(self.model_dump())


class CardBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    card: ConfirmCard


class BreakdownItem(BaseModel):
    field: CardField
    label: str
    earned: int
    maximum: int
    reason: str


class MissingField(BaseModel):
    field: CardField
    label: str
    potential_points: int
    recommendation: str


class ScoreResult(BaseModel):
    score: int = Field(ge=0, le=100)
    readiness_level: ReadinessSlug
    breakdown: list[BreakdownItem]
    missing_fields: list[MissingField]


CONTEXT_PREVIEW_LENGTH = 200


class TaskSummary(BaseModel):
    id: uuid.UUID
    title: str | None
    topic: TopicSlug | None
    context_preview: str | None
    score: int | None
    readiness_level: ReadinessSlug | None
    missing_fields: list[MissingField] | None
    status: Literal["draft", "published"]
    published_at: datetime | None
    proposals_count: int


class TaskDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Literal["draft", "published"]
    draft_text: str
    title: str | None
    topic: TopicSlug | None
    card: TaskCard
    score: int | None = Field(ge=0, le=100)
    readiness_level: ReadinessSlug | None
    score_breakdown: list[BreakdownItem] | None
    missing_fields: list[MissingField] | None
    confirmed_at: datetime | None
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    proposals_count: int
