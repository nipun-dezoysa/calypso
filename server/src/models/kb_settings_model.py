from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, validates

from src.database import Base

# There is only ever one settings row; it is created lazily with this id.
SETTINGS_SINGLETON_ID = "default"

VECTOR_DB_PROVIDERS = {"chroma", "qdrant"}
EMBEDDING_PROVIDERS = {"fastembed", "nomic"}


class KbSettings(Base):

    __tablename__ = "kb_settings"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=SETTINGS_SINGLETON_ID,
    )

    vector_db_provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="chroma",
    )

    qdrant_url: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
        default=None,
    )

    qdrant_api_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        default=None,
    )

    embedding_provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="fastembed",
    )

    embedding_model: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        default=None,
    )

    nomic_api_key: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        default=None,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    @validates("vector_db_provider")
    def validate_vector_db_provider(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in VECTOR_DB_PROVIDERS:
            raise ValueError(
                f"vector_db_provider must be one of {sorted(VECTOR_DB_PROVIDERS)}"
            )
        return value

    @validates("embedding_provider")
    def validate_embedding_provider(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in EMBEDDING_PROVIDERS:
            raise ValueError(
                f"embedding_provider must be one of {sorted(EMBEDDING_PROVIDERS)}"
            )
        return value

    def __repr__(self) -> str:
        return (
            f"<KbSettings(vector_db_provider={self.vector_db_provider!r}, "
            f"embedding_provider={self.embedding_provider!r})>"
        )
