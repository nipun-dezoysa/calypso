import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.workflow_model import Workflow

# Node types. Only "agent" is implemented today; more component types (e.g. KB,
# MCP, condition, ...) will be added here as they are built.
NODE_TYPE_AGENT = "agent"
NODE_TYPES = {NODE_TYPE_AGENT}


class Node(Base):
    """A single node in a workflow graph.

    `i_id` is a loose reference to the underlying component instance the node
    wraps (an agent id today; other component ids in future), so it is stored as
    a plain string rather than a hard foreign key. Connections between nodes live
    in the separate `edges` table."""

    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Workflow this node belongs to.
    w_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=NODE_TYPE_AGENT,
    )

    # Whether this node is the workflow's entry point.
    is_start: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    # Id of the component instance this node wraps (e.g. an agent id).
    i_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        default=None,
    )

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="nodes",
    )

    @validates("type")
    def validate_type(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in NODE_TYPES:
            raise ValueError(f"type must be one of {sorted(NODE_TYPES)}")
        return value

    def __repr__(self) -> str:
        return f"<Node(id={self.id!r}, w_id={self.w_id!r}, type={self.type!r})>"
