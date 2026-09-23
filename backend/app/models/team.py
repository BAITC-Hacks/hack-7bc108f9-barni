import uuid

from sqlalchemy import Integer, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text)
    interests: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    skills: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    technologies: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    points: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
