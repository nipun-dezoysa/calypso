import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base
from src.models.workflow_agent_links import (
    workflow_agent_collection,
    workflow_agent_mcp_server,
)

if TYPE_CHECKING:
    from src.models.agent_model import Agent
    from src.models.kb_collection_model import KbCollection
    from src.models.llm_model import LLMModel
    from src.models.mcp_server_model import McpServer
    from src.models.node_model import Node
    from src.models.workflow_model import Workflow


class WorkflowAgent(Base):

    __tablename__ = "workflow_agents"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Workflow this agent belongs to.
    w_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The agent node this configures. One config per node.
    n_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False, default="")

    agent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("agents.id", ondelete="SET NULL"),
        nullable=True,
        default=None,
        index=True,
    )

    # Model override. Falls back to the base agent's model when null.
    llm_model_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("llm_models.id", ondelete="RESTRICT"),
        nullable=True,
        default=None,
        index=True,
    )

    node_instructions: Mapped[str] = mapped_column(Text, nullable=False, default="")

    output_instructions: Mapped[str] = mapped_column(Text, nullable=False, default="")

    creativity: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    # Markdown-formatting override. Null inherits the base agent's setting
    # (false with no base agent); true/false pins it regardless of the base.
    markdown_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None)

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="agent_nodes",
    )

    node: Mapped["Node"] = relationship(
        "Node",
        back_populates="agent_config",
    )

    agent: Mapped["Agent | None"] = relationship("Agent", lazy="selectin")

    llm_model: Mapped["LLMModel | None"] = relationship("LLMModel", lazy="joined")

    collections: Mapped[list["KbCollection"]] = relationship(
        "KbCollection",
        secondary=workflow_agent_collection,
        lazy="selectin",
    )

    mcp_servers: Mapped[list["McpServer"]] = relationship(
        "McpServer",
        secondary=workflow_agent_mcp_server,
        lazy="selectin",
    )

    @validates("creativity")
    def validate_creativity(self, _key: str, value: int | None) -> int | None:
        if value is not None and not 0 <= value <= 100:
            raise ValueError("creativity must be between 0 and 100")
        return value

    def __repr__(self) -> str:
        return f"<WorkflowAgent(id={self.id!r}, n_id={self.n_id!r}, name={self.name!r})>"
