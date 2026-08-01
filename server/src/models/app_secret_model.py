from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base


class AppSecret(Base):
    """Server-generated secrets that must outlive a restart, keyed by name.
    Currently holds only the JWT signing key (when JWT_SECRET is not set)."""

    __tablename__ = "app_secrets"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)

    value: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<AppSecret(key={self.key!r})>"
