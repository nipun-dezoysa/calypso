import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

if TYPE_CHECKING:
    from src.models.workflow_model import Workflow


class Edge(Base):
    """A directed connection between two nodes in a workflow: source → target."""

    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Workflow this edge belongs to.
    w_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Source and target node ids (outgoing edge points source -> target).
    source: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    target: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="edges",
    )

    def __repr__(self) -> str:
        return f"<Edge(id={self.id!r}, source={self.source!r}, target={self.target!r})>"
