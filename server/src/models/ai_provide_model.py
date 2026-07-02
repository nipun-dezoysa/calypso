import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.llm_model import LLMModel


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    provider_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    url: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
    )

    secret_key: Mapped[str | None] = mapped_column(
        String(500),
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

    models: Mapped[list["LLMModel"]] = relationship(
        "LLMModel",
        back_populates="ai_provider",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @property
    def model_names(self) -> list[str]:
        """Names of the models this provider offers, derived from `models`."""
        return [m.model_name for m in self.models]

    @validates("provider_name")
    def validate_provider_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("provider_name must not be empty")
        return value.strip()

    @validates("url")
    def validate_url(self, _key: str, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value.startswith(("http://", "https://")):
            raise ValueError("url must start with http:// or https://")
        return value

    def __repr__(self) -> str:
        return f"<AIProvider(id={self.id!r}, provider_name={self.provider_name!r})>"
