import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from src.database import Base


class User(Base):
    """An operator of the admin UI. There is normally exactly one, seeded with
    the default credentials on first boot."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    username: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    # True while the account still carries the credentials it was seeded with;
    # the client sends the user to the update-credentials screen until it clears.
    must_change_credentials: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
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

    @validates("username")
    def validate_username(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("username must not be empty")
        return value.strip()

    def __repr__(self) -> str:
        return f"<User(id={self.id!r}, username={self.username!r})>"
