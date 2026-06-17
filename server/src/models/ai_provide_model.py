import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from src.database import Base


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

    model_names: Mapped[list] = mapped_column(
        JSON,
        nullable=False,
        default=list,
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

    @validates("provider_name")
    def validate_provider_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("provider_name must not be empty")
        return value.strip()

    @validates("model_names")
    def validate_model_names(self, _key: str, value: list) -> list:
        if not isinstance(value, list):
            raise ValueError("model_names must be a list")
        if not all(isinstance(item, str) and item.strip() for item in value):
            raise ValueError("All items in model_names must be non-empty strings")
        return [item.strip() for item in value]

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
