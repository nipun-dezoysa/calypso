from sqlalchemy import Column, ForeignKey, Table
from src.database import Base

agent_collection = Table(
    "agent_collections",
    Base.metadata,
    Column(
        "agent_id",
        ForeignKey("agents.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "collection_id",
        ForeignKey("kb_collections.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)
