import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.condition_model import Condition
    from src.models.edge_model import Edge
    from src.models.node_model import Node
    from src.models.thread_model import Thread
    from src.models.workflow_agent_model import WorkflowAgent


class Workflow(Base):
    """A workflow: a named graph of nodes wired together."""

    __tablename__ = "workflows"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
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

    nodes: Mapped[list["Node"]] = relationship(
        "Node",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    edges: Mapped[list["Edge"]] = relationship(
        "Edge",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    conditions: Mapped[list["Condition"]] = relationship(
        "Condition",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    agent_nodes: Mapped[list["WorkflowAgent"]] = relationship(
        "WorkflowAgent",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    # Threads owned by this workflow. ORM-level cascade (this codebase does not
    # enable SQLite FK enforcement), mirroring Agent.threads.
    threads: Mapped[list["Thread"]] = relationship(
        "Thread",
        back_populates="workflow",
        cascade="all, delete-orphan",
    )

    @validates("name")
    def validate_name(self, _key: str, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("name must not be empty")
        return value.strip()

    def __repr__(self) -> str:
        return f"<Workflow(id={self.id!r}, name={self.name!r})>"
