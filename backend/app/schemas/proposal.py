import uuid
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    StringConstraints,
)

from app.schemas.task import blank_to_none

ProposalStatus = Literal["pending", "accepted", "rejected"]


def http_url(value: str | None) -> str | None:
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or " " in value:
        raise ValueError("Ссылка должна начинаться с http:// или https://")
    return value


def text(max_length: int):
    return Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)
    ]


class ProposalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    team_id: uuid.UUID
    idea: text(3000)
    plan: text(3000)
    estimated_duration: text(100)
    prototype_url: Annotated[
        str | None,
        BeforeValidator(blank_to_none),
        StringConstraints(max_length=2000),
        AfterValidator(http_url),
    ] = None


class ProposalDecision(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["accepted", "rejected"]


class ProposalOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    task_title: str | None
    team_id: uuid.UUID
    team_name: str
    idea: str
    plan: str
    estimated_duration: str
    prototype_url: str | None
    status: ProposalStatus
    created_at: datetime
    updated_at: datetime
