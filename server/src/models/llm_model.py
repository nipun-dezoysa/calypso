import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.agent_model import Agent
    from src.models.ai_provide_model import AIProvider


class LLMModel(Base):
    """A specific model (e.g. 'gpt-4o') offered by an AIProvider."""

    __tablename__ = "llm_models"
    __table_args__ = (UniqueConstraint("ai_provider_id", "model_name"),)

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    ai_provider_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("ai_providers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    model_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    ai_provider: Mapped["AIProvider"] = relationship(
        "AIProvider",
        back_populates="models",
        lazy="joined",
    )

    agents: Mapped[list["Agent"]] = relationship(
        "Agent",
        back_populates="llm_model",
    )

    @property
    def provider_name(self) -> str:
        return self.ai_provider.provider_name

    @validates("model_name")
    def validate_model_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("model_name must not be empty")
        return value.strip()

    def __repr__(self) -> str:
        return f"<LLMModel(id={self.id!r}, model_name={self.model_name!r})>"
