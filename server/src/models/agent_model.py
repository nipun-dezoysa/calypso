import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base
from src.models.agent_collection import agent_collection
from src.models.agent_graph_db import agent_graph_db
from src.models.agent_mcp_server import agent_mcp_server

if TYPE_CHECKING:
    from src.models.graph_db_model import GraphDatabase
    from src.models.kb_collection_model import KbCollection
    from src.models.llm_model import LLMModel
    from src.models.mcp_server_model import McpServer
    from src.models.thread_model import Thread


class Agent(Base):
    __tablename__ = "agents"

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

    llm_model_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("llm_models.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    agent_instructions: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    # 0-100 creativity slider exposed to users; mapped to the provider's
    # native temperature range (commonly 0.0-2.0) when calling the LLM.
    creativity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=50,
    )

    # When set, predefined markdown-formatting instructions are appended to
    # agent_instructions at runtime (see ChatService), never persisted here.
    markdown_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
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

    llm_model: Mapped["LLMModel"] = relationship(
        "LLMModel",
        back_populates="agents",
        lazy="joined",
    )

    threads: Mapped[list["Thread"]] = relationship(
        "Thread",
        back_populates="agent",
        cascade="all, delete-orphan",
    )

    # Knowledge-base collections attached to this agent, used to retrieve
    # context during chat. Eager-loaded so responses and RAG can read them.
    collections: Mapped[list["KbCollection"]] = relationship(
        "KbCollection",
        secondary=agent_collection,
        back_populates="agents",
        lazy="selectin",
    )

    # MCP servers attached to this agent, whose tools the agent can call.
    mcp_servers: Mapped[list["McpServer"]] = relationship(
        "McpServer",
        secondary=agent_mcp_server,
        back_populates="agents",
        lazy="selectin",
    )

    # Graph databases attached to this agent. Each contributes a schema and a
    # query tool at answer time, alongside the MCP tools.
    graph_dbs: Mapped[list["GraphDatabase"]] = relationship(
        "GraphDatabase",
        secondary=agent_graph_db,
        back_populates="agents",
        lazy="selectin",
    )

    @validates("name")
    def validate_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()

    @validates("agent_instructions")
    def validate_agent_instructions(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("agent_instructions must not be empty")
        return value.strip()

    @validates("creativity")
    def validate_creativity(self, _key: str, value: int) -> int:
        if not 0 <= value <= 100:
            raise ValueError("creativity must be between 0 and 100")
        return value

    def __repr__(self) -> str:
        return f"<Agent(id={self.id!r}, name={self.name!r})>"
