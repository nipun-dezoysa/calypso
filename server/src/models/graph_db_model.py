import re
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base
from src.models.agent_graph_db import agent_graph_db

if TYPE_CHECKING:
    from src.models.agent_model import Agent

NEO4J = "neo4j"

# Only Neo4j today. The column exists so a second Bolt/Cypher engine can be
# added without a migration; everything else here is already engine-agnostic.
GRAPH_DB_PROVIDERS = {NEO4J}

# bolt:// and neo4j:// plus their TLS variants are what the driver accepts.
URI_SCHEMES = (
    "bolt://",
    "bolt+s://",
    "bolt+ssc://",
    "neo4j://",
    "neo4j+s://",
    "neo4j+ssc://",
)

DEFAULT_QUERY_TIMEOUT = 15
DEFAULT_MAX_ROWS = 50

# Tool names must match ^[a-zA-Z0-9_-]+$ for most providers.
_TOOL_SAFE = re.compile(r"[^a-zA-Z0-9_-]+")


class GraphDatabase(Base):
    """A graph database the user owns, registered so agents can query it.

    Credentials are stored as given, the same way AI provider keys and the
    Qdrant key are; the password is never echoed back to the client (see
    GraphDbResponse, which exposes only `password_set`)."""

    __tablename__ = "graph_databases"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        unique=True,
        index=True,
    )

    provider: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=NEO4J,
    )

    uri: Mapped[str] = mapped_column(String(2048), nullable=False)

    username: Mapped[str | None] = mapped_column(
        String(200), nullable=True, default=None
    )

    # Null means an auth-less server; empty is normalised to null on write.
    password: Mapped[str | None] = mapped_column(
        String(500), nullable=True, default=None
    )

    # Null uses whatever the server considers its default database.
    database: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None
    )

    # When set, queries run in a read transaction, so a write clause is
    # rejected by the server rather than by a pattern match here.
    read_only: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Caps on what one agent-issued query may cost.
    query_timeout: Mapped[int] = mapped_column(
        Integer, nullable=False, default=DEFAULT_QUERY_TIMEOUT
    )
    max_rows: Mapped[int] = mapped_column(
        Integer, nullable=False, default=DEFAULT_MAX_ROWS
    )

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

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

    agents: Mapped[list["Agent"]] = relationship(
        "Agent",
        secondary=agent_graph_db,
        back_populates="graph_dbs",
    )

    @property
    def tool_suffix(self) -> str:
        """The part of a tool name that identifies this database. Falls back to
        the id when the name has nothing a tool name may contain."""
        slug = _TOOL_SAFE.sub("_", self.name).strip("_")[:40]
        return slug or f"db_{self.id.replace('-', '')[:8]}"

    def to_connection(self) -> dict:
        """Connection details for the graph client, without the ORM object."""
        return {
            "provider": self.provider,
            "uri": self.uri,
            "username": self.username,
            "password": self.password,
            "database": self.database,
            "read_only": self.read_only,
            "timeout": self.query_timeout,
            "max_rows": self.max_rows,
        }

    @validates("name")
    def validate_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()

    @validates("provider")
    def validate_provider(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in GRAPH_DB_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(GRAPH_DB_PROVIDERS)}")
        return value

    @validates("uri")
    def validate_uri(self, _key: str, value: str) -> str:
        value = (value or "").strip()
        if not value:
            raise ValueError("uri must not be empty")
        if not value.startswith(URI_SCHEMES):
            raise ValueError(f"uri must start with one of {list(URI_SCHEMES)}")
        return value

    @validates("password", "username", "database")
    def validate_optional_text(self, _key: str, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @validates("query_timeout")
    def validate_query_timeout(self, _key: str, value: int) -> int:
        if not 1 <= value <= 120:
            raise ValueError("query_timeout must be between 1 and 120 seconds")
        return value

    @validates("max_rows")
    def validate_max_rows(self, _key: str, value: int) -> int:
        if not 1 <= value <= 500:
            raise ValueError("max_rows must be between 1 and 500")
        return value

    def __repr__(self) -> str:
        return (
            f"<GraphDatabase(id={self.id!r}, name={self.name!r}, "
            f"provider={self.provider!r})>"
        )
