from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.repositories import teams
from app.schemas.task import READINESS_LEVELS, TOPICS, MetaOut, TeamOut

router = APIRouter(prefix="/api", tags=["meta"])
DB = Annotated[Session, Depends(get_db)]


@router.get("/meta", response_model=MetaOut)
def get_meta():
    return {"topics": TOPICS, "readiness_levels": READINESS_LEVELS}


@router.get("/teams", response_model=list[TeamOut])
def list_teams(db: DB):
    return teams.list_all(db)
