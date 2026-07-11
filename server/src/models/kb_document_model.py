import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.kb_collection_model import KbCollection


class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class KbDocument(Base):

    __tablename__ = "kb_documents"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    collection_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("kb_collections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    filename: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    # Absolute or working-dir-relative path to the stored upload on disk.
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

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=DocumentStatus.PENDING.value,
        index=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
    )

    chunk_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
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

    collection: Mapped["KbCollection"] = relationship(
        "KbCollection",
        back_populates="documents",
    )

    @validates("status")
    def validate_status(self, _key: str, value: str) -> str:
        # Accept either the enum or its string value.
        value = value.value if isinstance(value, DocumentStatus) else value
        if value not in {s.value for s in DocumentStatus}:
            raise ValueError(f"invalid document status: {value!r}")
        return value

    def __repr__(self) -> str:
        return (
            f"<KbDocument(id={self.id!r}, filename={self.filename!r}, "
            f"status={self.status!r})>"
        )
