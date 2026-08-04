import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.message_model import Message
KIND_DOCUMENT = "document"
KIND_IMAGE = "image"
KINDS = {KIND_DOCUMENT, KIND_IMAGE}


class AttachmentStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"


class Attachment(Base):

    __tablename__ = "attachments"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    message_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
        default=None,
    )

    filename: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    file_path: Mapped[str] = mapped_column(
        String(1024),
        nullable=False,
    )

    content_type: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        default=None,
    )

    size_bytes: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=None,
    )

    kind: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=KIND_DOCUMENT,
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=AttachmentStatus.COMPLETED.value,
    )

    extracted_text: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    message: Mapped["Message | None"] = relationship(
        "Message",
        back_populates="attachments",
    )

    @validates("kind")
    def validate_kind(self, _key: str, value: str) -> str:
        if value not in KINDS:
            raise ValueError(f"invalid attachment kind: {value!r}")
        return value

    @validates("status")
    def validate_status(self, _key: str, value: str) -> str:
        value = value.value if isinstance(value, AttachmentStatus) else value
        if value not in {s.value for s in AttachmentStatus}:
            raise ValueError(f"invalid attachment status: {value!r}")
        return value

    def __repr__(self) -> str:
        return (
            f"<Attachment(id={self.id!r}, filename={self.filename!r}, "
            f"kind={self.kind!r})>"
        )
