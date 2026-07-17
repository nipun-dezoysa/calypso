import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base
from src.models.agent_mcp_server import agent_mcp_server

if TYPE_CHECKING:
    from src.models.agent_model import Agent

STDIO = "stdio"
STREAMABLE_HTTP = "streamable_http"
SSE = "sse"
WEBSOCKET = "websocket"

MCP_TRANSPORTS = {STDIO, STREAMABLE_HTTP, SSE, WEBSOCKET}
URL_TRANSPORTS = {STREAMABLE_HTTP, SSE, WEBSOCKET}


class McpServer(Base):

    __tablename__ = "mcp_servers"

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

    transport: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=STDIO,
    )

    # ── stdio transport ──
    command: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)
    args: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    env: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)
    cwd: Mapped[str | None] = mapped_column(String(1024), nullable=True, default=None)

    url: Mapped[str | None] = mapped_column(String(2048), nullable=True, default=None)
    headers: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False, default=dict)

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
        secondary=agent_mcp_server,
        back_populates="mcp_servers",
    )

    @validates("name")
    def validate_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()

    @validates("transport")
    def validate_transport(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in MCP_TRANSPORTS:
            raise ValueError(f"transport must be one of {sorted(MCP_TRANSPORTS)}")
        return value

    def to_connection(self) -> dict:
        """Build the connection dict consumed by MultiServerMCPClient. Only the
        keys relevant to this server's transport are included."""
        if self.transport == STDIO:
            conn: dict = {
                "transport": STDIO,
                "command": self.command,
                "args": list(self.args or []),
            }
            if self.env:
                conn["env"] = dict(self.env)
            if self.cwd:
                conn["cwd"] = self.cwd
            return conn

        conn = {"transport": self.transport, "url": self.url}
        if self.headers and self.transport in {STREAMABLE_HTTP, SSE}:
            conn["headers"] = dict(self.headers)
        return conn

    def __repr__(self) -> str:
        return f"<McpServer(id={self.id!r}, name={self.name!r}, transport={self.transport!r})>"
