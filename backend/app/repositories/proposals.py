import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models import Proposal, Task, Team
from app.schemas.proposal import ProposalCreate, ProposalOut


def _query():
    return (
        select(Proposal, Task.title, Team.name)
        .join(Task, Task.id == Proposal.task_id)
        .join(Team, Team.id == Proposal.team_id)
    )


def _out(row) -> ProposalOut:
    proposal, task_title, team_name = row
    return ProposalOut(
        id=proposal.id,
        task_id=proposal.task_id,
        task_title=task_title,
        team_id=proposal.team_id,
        team_name=team_name,
        idea=proposal.idea,
        plan=proposal.plan,
        estimated_duration=proposal.estimated_duration,
        prototype_url=proposal.prototype_url,
        status=proposal.status,
        created_at=proposal.created_at,
        updated_at=proposal.updated_at,
    )


def get(db: Session, proposal_id: uuid.UUID) -> ProposalOut | None:
    row = db.execute(_query().where(Proposal.id == proposal_id)).first()
    return _out(row) if row else None


def create(db: Session, task_id: uuid.UUID, body: ProposalCreate) -> ProposalOut:
    proposal = Proposal(task_id=task_id, **body.model_dump())
    db.add(proposal)
    db.commit()
    return get(db, proposal.id)


def list_for_task(db: Session, task_id: uuid.UUID) -> list[ProposalOut]:
    query = _query().where(Proposal.task_id == task_id)
    return [_out(row) for row in db.execute(query.order_by(Proposal.created_at))]


def list_for_team(db: Session, team_id: uuid.UUID) -> list[ProposalOut]:
    query = _query().where(Proposal.team_id == team_id)
    return [_out(row) for row in db.execute(query.order_by(Proposal.created_at))]


def decide(db: Session, proposal_id: uuid.UUID, status: str) -> bool:
    # Conditional update: two concurrent decisions cannot both succeed.
    result = db.execute(
        update(Proposal)
        .where(Proposal.id == proposal_id, Proposal.status == "pending")
        .values(status=status, updated_at=func.now())
    )
    db.commit()
    return result.rowcount == 1
