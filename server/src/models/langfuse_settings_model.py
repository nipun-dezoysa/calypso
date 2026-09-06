from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from src.database import Base

# Like KbSettings, there is only ever one row; it is created lazily with this id.
LANGFUSE_SETTINGS_SINGLETON_ID = "default"


class LangfuseSettings(Base):
    """Langfuse tracing credentials, editable from the UI. This row is the only
    place they live - there is nothing to set on the server."""

    __tablename__ = "langfuse_settings"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=LANGFUSE_SETTINGS_SINGLETON_ID,
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    host: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
    )

    public_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        default=None,
    )

    secret_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        default=None,
    )

    # Free-form label Langfuse groups traces by, e.g. "production" or "staging".
    environment: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        default=None,
    )

    # Fraction of traces actually sent, 0.0–1.0.
    sample_rate: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=1.0,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @validates("sample_rate")
    def validate_sample_rate(self, _key: str, value: float) -> float:
        if not 0.0 <= value <= 1.0:
            raise ValueError("sample_rate must be between 0.0 and 1.0")
        return value

    @validates("environment")
    def validate_environment(self, _key: str, value: str | None) -> str | None:
        """Langfuse rejects environments starting with 'langfuse' and only
        accepts lowercase letters, digits, underscores and dashes."""
        if value is None:
            return None
        value = value.strip().lower()
        if not value:
            return None
        if value.startswith("langfuse"):
            raise ValueError("environment must not start with 'langfuse'")
        if not all(c.isalnum() or c in "-_" for c in value):
            raise ValueError(
                "environment may only contain letters, digits, '-' and '_'"
            )
        return value

    def __repr__(self) -> str:
        return (
            f"<LangfuseSettings(enabled={self.enabled!r}, host={self.host!r}, "
            f"environment={self.environment!r})>"
        )
