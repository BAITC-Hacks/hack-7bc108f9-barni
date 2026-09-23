from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Team


def list_all(db: Session) -> list[Team]:
    return list(db.scalars(select(Team).order_by(Team.name)))
