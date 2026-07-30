import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.condition_model import Condition
    from src.models.workflow_agent_model import WorkflowAgent
    from src.models.workflow_model import Workflow

NODE_TYPE_AGENT = "agent"
NODE_TYPE_CONDITION = "condition"
NODE_TYPES = {NODE_TYPE_AGENT, NODE_TYPE_CONDITION}


class Node(Base):

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

    # Id of the component instance this node wraps. Unused by current node types.
    i_id: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        default=None,
    )

    # Canvas position, persisted so the visual builder can restore the layout.
    position_x: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    position_y: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="nodes",
    )

    # Branches, for condition nodes. Empty for every other node type.
    conditions: Mapped[list["Condition"]] = relationship(
        "Condition",
        back_populates="node",
        cascade="all, delete-orphan",
    )

    # The workflow-scoped agent backing an agent node. None for other types.
    # Eager: the graph runner reads it for every node it executes.
    agent_config: Mapped["WorkflowAgent | None"] = relationship(
        "WorkflowAgent",
        back_populates="node",
        cascade="all, delete-orphan",
        uselist=False,
        lazy="selectin",
    )

    @validates("type")
    def validate_type(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in NODE_TYPES:
            raise ValueError(f"type must be one of {sorted(NODE_TYPES)}")
        return value

    def __repr__(self) -> str:
        return f"<Node(id={self.id!r}, w_id={self.w_id!r}, type={self.type!r})>"
