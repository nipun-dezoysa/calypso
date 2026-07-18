import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.agent_model import Agent
    from src.models.message_model import Message
    from src.models.workflow_model import Workflow

# A thread belongs to either an agent or a workflow, distinguished by `type`.
THREAD_TYPE_AGENT = "agent"
THREAD_TYPE_WORKFLOW = "workflow"
THREAD_TYPES = {THREAD_TYPE_AGENT, THREAD_TYPE_WORKFLOW}


class Thread(Base):
    """A conversation owned by either an Agent or a Workflow (see `type`)."""

    __tablename__ = "threads"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Whether this thread belongs to an agent or a workflow.
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=THREAD_TYPE_AGENT,
        index=True,
    )

    # Exactly one of agent_id / workflow_id is set, per `type`. Both are nullable
    # so a workflow thread carries no agent and vice versa.
    agent_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    workflow_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    title: Mapped[str | None] = mapped_column(
        String(200),
        nullable=True,
        default=None,
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

    agent: Mapped["Agent | None"] = relationship("Agent", back_populates="threads")

    workflow: Mapped["Workflow | None"] = relationship(
        "Workflow", back_populates="threads"
    )

    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
        lazy="selectin",
    )

    @validates("type")
    def validate_type(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in THREAD_TYPES:
            raise ValueError(f"type must be one of {sorted(THREAD_TYPES)}")
        return value

    @validates("title")
    def validate_title(self, _key: str, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    def __repr__(self) -> str:
        return f"<Thread(id={self.id!r}, type={self.type!r})>"
