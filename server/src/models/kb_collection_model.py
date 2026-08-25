import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base
from src.models.agent_collection import agent_collection

if TYPE_CHECKING:
    from src.models.agent_model import Agent
    from src.models.kb_document_model import KbDocument


class KbCollection(Base):

    __tablename__ = "kb_collections"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    documents: Mapped[list["KbDocument"]] = relationship(
        "KbDocument",
        back_populates="collection",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Agents this collection is attached to. Not eager-loaded, accessed only
    # via the agent side; kept here so ORM deletes clean up the link rows.
    agents: Mapped[list["Agent"]] = relationship(
        "Agent",
        secondary=agent_collection,
        back_populates="collections",
    )

    @property
    def vector_collection_name(self) -> str:
        return f"kb_{self.id.replace('-', '')}"

    @validates("name")
    def validate_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()

    def __repr__(self) -> str:
        return f"<KbCollection(id={self.id!r}, name={self.name!r})>"
