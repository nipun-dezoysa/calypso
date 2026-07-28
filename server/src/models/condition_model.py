import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from src.database import Base

if TYPE_CHECKING:
    from src.models.node_model import Node
    from src.models.workflow_model import Workflow

OPERATOR_ALWAYS = "always"
CONDITION_OPERATORS = {
    "contains",
    "not_contains",
    "equals",
    "not_equals",
    "starts_with",
    "ends_with",
    "regex",
    OPERATOR_ALWAYS,
}

# Operators that ignore `value`.
VALUELESS_OPERATORS = {OPERATOR_ALWAYS}


class Condition(Base):

    __tablename__ = "conditions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # Workflow this branch belongs to.
    w_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("workflows.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # The condition node this branch hangs off.
    n_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Shown on the branch's handle in the builder (e.g. "billing", "yes").
    label: Mapped[str] = mapped_column(String(100), nullable=False, default="")

    operator: Mapped[str] = mapped_column(String(20), nullable=False, default="contains")

    # The text the operator compares against. Unused by "always".
    value: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    case_sensitive: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Evaluation order within the node; lowest first, first match wins.
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    workflow: Mapped["Workflow"] = relationship(
        "Workflow",
        back_populates="conditions",
    )

    node: Mapped["Node"] = relationship(
        "Node",
        back_populates="conditions",
    )

    @validates("operator")
    def validate_operator(self, _key: str, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in CONDITION_OPERATORS:
            raise ValueError(f"operator must be one of {sorted(CONDITION_OPERATORS)}")
        return value

    def __repr__(self) -> str:
        return (
            f"<Condition(id={self.id!r}, n_id={self.n_id!r}, "
            f"operator={self.operator!r}, value={self.value!r})>"
        )
