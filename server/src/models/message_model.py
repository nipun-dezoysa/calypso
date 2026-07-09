import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.thread_model import Thread


class Message(Base):
    """A single message (user question or agent answer) within a Thread."""

    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    thread_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("threads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_bot: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
    )

    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    thread: Mapped["Thread"] = relationship(
        "Thread",
        back_populates="messages",
    )

    @validates("content")
    def validate_content(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("content must not be empty")
        return value.strip()

    def __repr__(self) -> str:
        return f"<Message(id={self.id!r}, is_bot={self.is_bot!r})>"
