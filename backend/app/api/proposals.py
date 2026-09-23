import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.tasks import get_or_404
from app.db import get_db
from app.models import Team
from app.repositories import proposals
from app.schemas.proposal import ProposalCreate, ProposalDecision, ProposalOut

router = APIRouter(prefix="/api", tags=["proposals"])
DB = Annotated[Session, Depends(get_db)]


def error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status, {"code": code, "message": message})


def require_team(db: Session, team_id: uuid.UUID) -> None:
    if db.get(Team, team_id) is None:
        raise error(404, "TEAM_NOT_FOUND", "Команда не найдена")


@router.post("/tasks/{task_id}/proposals", response_model=ProposalOut, status_code=201)
def create_proposal(task_id: uuid.UUID, body: ProposalCreate, db: DB):
    task = get_or_404(db, task_id)
    require_team(db, body.team_id)
    if task.status != "published":
        raise error(
            409, "TASK_NOT_PUBLISHED", "Предложение можно отправить только на опубликованную задачу"
        )
    return proposals.create(db, task_id, body)


@router.get("/tasks/{task_id}/proposals", response_model=list[ProposalOut])
def list_task_proposals(task_id: uuid.UUID, db: DB):
    get_or_404(db, task_id)
    return proposals.list_for_task(db, task_id)


@router.get("/proposals", response_model=list[ProposalOut])
def list_team_proposals(team_id: Annotated[uuid.UUID, Query()], db: DB):
    require_team(db, team_id)
    return proposals.list_for_team(db, team_id)


@router.patch("/proposals/{proposal_id}", response_model=ProposalOut)
def decide_proposal(proposal_id: uuid.UUID, body: ProposalDecision, db: DB):
    if not proposals.decide(db, proposal_id, body.status):
        if proposals.get(db, proposal_id) is None:
            raise error(404, "PROPOSAL_NOT_FOUND", "Предложение не найдено")
        raise error(409, "PROPOSAL_ALREADY_DECIDED", "Решение по предложению уже принято")
    return proposals.get(db, proposal_id)
